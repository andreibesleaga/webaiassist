// SPDX-License-Identifier: Apache-2.0
// `npm run eval:gpu`: the automated eval of docs/EVAL.md. For each model it starts the model in
// the side panel, asks the 20 prompts on the stub node (and on the live node), scores them, runs
// the observable checks, takes four screenshots and writes the report and the docs/EVAL.md block.
// `--scripted` runs the same flow with the scripted test model (no GPU needed).
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { release } from 'node:os';
import { join } from 'node:path';
import { format } from 'prettier';
import { parseEvalArgs, MODEL_IDS, type EvalArgs, type ModelKey } from './args.ts';
import { cancelCheck, MANUAL, runChecks } from './checks.ts';
import { ask, clearMemory, modelStatus, pageTools, selectModel, startModel } from './panel.ts';
import { loadPrompts, promptsFor, type PromptFile } from './prompts.ts';
import {
  fillEvalMd,
  renderResults,
  stoppedModel,
  writeReport,
  type CheckResult,
  type EvalReport,
  type ModelLine,
} from './report.ts';
import { scorePrompt, summarize, type Row } from './score.ts';
import { startSession, type EvalSession } from './session.ts';

const TOOL_NAMES: string[] = (
  JSON.parse(readFileSync('fixtures/agsc-tools.json', 'utf8')) as { tools: { name: string }[] }
).tools.map((t) => t.name);

interface Shots {
  readonly dir: string;
  readonly taken: Set<string>;
}
interface Ctx {
  readonly args: EvalArgs;
  readonly session: EvalSession;
  readonly file: PromptFile;
  readonly shots: Shots;
  readonly rows: Row[];
  readonly targets: EvalReport['targets'][number][];
  readonly models: ModelLine[];
  readonly early: CheckResult[];
  /** The first Start: requests inside it are checked against docs/PRIVACY.md. */
  readonly window: { from: number; to: number };
}

async function shoot(shots: Shots, name: string, page: Page): Promise<void> {
  if (shots.taken.has(name)) return;
  shots.taken.add(name);
  await page.screenshot({ path: join(shots.dir, `${name}.png`) });
}

async function ensureReady(panel: Page, key: ModelKey, args: EvalArgs): Promise<ModelLine> {
  const id = MODEL_IDS[key];
  if ((await modelStatus(panel)).startsWith('Ready')) {
    return { key, id, ready: true, loadS: 0, status: await modelStatus(panel) };
  }
  await selectModel(panel, key);
  return { key, id, ...(await startModel(panel, args.startTimeoutMin)) };
}

/** A fresh chat: nothing remembered of any site, the panel page reloads and the model is started
 *  again if it must be. */
async function freshPanel(panel: Page, key: ModelKey, args: EvalArgs): Promise<void> {
  if (!args.keepChat) await clearMemory(panel);
  await panel.reload();
  await panel.locator('#page-status').filter({ hasNotText: 'No page yet.' }).waitFor();
  await ensureReady(panel, key, args);
}

/** Opens `url`; the panel's page line must show tools within `seconds`, else the reason. */
async function waitForTools(panel: Page, seconds: number): Promise<string | null> {
  for (let i = 0; i < seconds; i++) {
    if ((await pageTools(panel)) > 0) return null;
    await panel.waitForTimeout(1_000);
  }
  return `the panel shows no WebMCP tools after ${seconds} s`;
}

async function askAll(ctx: Ctx, panel: Page, key: ModelKey, target: string): Promise<void> {
  const { args, shots } = ctx;
  const prompts = promptsFor(ctx.file, target, args.prompts);
  for (const prompt of prompts) {
    const text = key === 'scripted' ? prompt.scripted : prompt.text;
    const onGate = (): Promise<void> => shoot(shots, '2-gate-dialog', panel);
    const seen = await ask(panel, text, args.promptTimeoutS, onGate);
    if ((await panel.locator('[data-trust="untrusted"]').count()) > 0) {
      await shoot(shots, '3-answer-untrusted', panel);
    }
    const row = scorePrompt(prompt, seen, { model: key, target, pageTools: TOOL_NAMES });
    ctx.rows.push(row);
    console.log(
      `  ${target} #${row.n}: tools [${row.tools.join(', ')}] ${seen.timedOut ? 'TIMED OUT' : ''} ${row.totalS} s`,
    );
    await freshPanel(panel, key, args);
  }
}

/** Opens the target and its panel; the reason it cannot be scored, or null when it was. */
async function tryTarget(
  ctx: Ctx,
  key: ModelKey,
  target: 'stub' | 'live',
  url: string,
): Promise<string | null> {
  try {
    const { tabId } = await ctx.session.openTarget(url);
    const panel = await ctx.session.openPanelFor(tabId);
    const why = await waitForTools(panel, target === 'stub' ? 10 : 20);
    if (why !== null) return why;
    // The first question too: the profile may hold this site's chat from an older run.
    await freshPanel(panel, key, ctx.args);
    await askAll(ctx, panel, key, target);
    return null;
  } catch (error) {
    return error instanceof Error ? (error.message.split('\n')[0] ?? 'failed') : String(error);
  }
}

async function runTarget(ctx: Ctx, key: ModelKey, target: 'stub' | 'live'): Promise<void> {
  const url = target === 'stub' ? `${ctx.session.stubUrl}/` : (ctx.file.targets.live?.url ?? '');
  const skipped = await tryTarget(ctx, key, target, url);
  if (!ctx.targets.some((t) => t.name === target)) {
    const info = { name: target, url, tools: TOOL_NAMES };
    ctx.targets.push(skipped === null ? info : { ...info, tools: [], skipped });
  }
  if (skipped !== null) console.log(`  ${target}: skipped (${skipped})`);
}

/** The graphics card the panel gets, as "vendor/architecture"; undefined when there is none. */
async function adapterOf(panel: Page): Promise<string | undefined> {
  return panel.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return undefined;
    return `${adapter.info.vendor || 'unknown'}/${adapter.info.architecture || 'unknown'}`;
  });
}

async function chromeVersion(session: EvalSession, panel: Page): Promise<string> {
  if (session.chromeVersion !== 'unknown') return session.chromeVersion;
  const ua = await panel.evaluate(() => navigator.userAgent);
  return /Chrom(?:e|ium)\/([\d.]+)/.exec(ua)?.[1] ?? 'unknown';
}

async function optionsShot(ctx: Ctx): Promise<void> {
  const page = await ctx.session.openExtensionPage('options.html');
  await shoot(ctx.shots, '4-options-page', page);
  await page.close();
}

async function startFirst(ctx: Ctx, panel: Page, key: ModelKey): Promise<ModelLine> {
  const first = ctx.models.length === 0;
  if (first) {
    ctx.window.from = Date.now();
    if (ctx.args.cancelCheck) ctx.early.push(await cancelCheck(ctx.session, panel, ctx.args));
  }
  const line = await ensureReady(panel, key, ctx.args);
  if (first) ctx.window.to = Date.now();
  return line;
}

async function runModel(ctx: Ctx, key: ModelKey): Promise<void> {
  const { tabId } = await ctx.session.openTarget(`${ctx.session.stubUrl}/`);
  const panel = await ctx.session.openPanelFor(tabId);
  console.log(`Model ${key}: start`);
  const line = await startFirst(ctx, panel, key);
  ctx.models.push(line);
  console.log(`  ${line.status} (${line.loadS} s)`);
  if (!line.ready) return;
  await shoot(ctx.shots, '1-status-ready', panel);
  await runTarget(ctx, key, 'stub');
  if (ctx.args.live) await runTarget(ctx, key, 'live');
}

/** One model; when its part throws, it is recorded as stopped and the run goes on. */
async function runModelSafely(ctx: Ctx, key: ModelKey): Promise<void> {
  try {
    await runModel(ctx, key);
  } catch (error) {
    const line = stoppedModel(key, error);
    const at = ctx.models.findIndex((model) => model.key === key);
    if (at === -1) ctx.models.push(line);
    console.log(`  ${line.status}`);
  }
}

async function lastPanel(ctx: Ctx): Promise<Page> {
  const { tabId } = await ctx.session.openTarget(`${ctx.session.stubUrl}/`);
  return ctx.session.openPanelFor(tabId);
}

/** The checks after the last model (requests, Options page); a hung browser skips them. */
async function closingChecks(ctx: Ctx): Promise<{ late: CheckResult[]; chrome: string }> {
  const { args, session } = ctx;
  const panel = await lastPanel(ctx);
  await ensureReady(panel, args.models.at(-1) ?? 'scripted', args);
  const late = await runChecks(session, panel, args, ctx.window);
  await optionsShot(ctx);
  return { late, chrome: await chromeVersion(session, panel) };
}

async function finish(ctx: Ctx, adapter: string | undefined): Promise<void> {
  const { args, session } = ctx;
  const closing = await closingChecks(ctx).catch((error: unknown) => {
    console.log(`  closing checks skipped: ${stoppedModel('', error).status}`);
    return { late: [] as CheckResult[], chrome: session.chromeVersion };
  });
  const report: EvalReport = {
    date: new Date().toISOString().slice(0, 10),
    chrome: closing.chrome,
    os: `${process.platform} ${release()}`,
    scripted: args.scripted,
    webgpu: { panelAdapter: adapter !== undefined, ...(adapter ? { adapter } : {}) },
    models: ctx.models,
    targets: ctx.targets,
    rows: ctx.rows,
    summary: summarize(ctx.rows),
    checks: [...ctx.early, ...closing.late],
    manual: MANUAL,
  };
  const path = writeReport(args.outDir, report);
  const block = renderResults(report, path);
  // Written as Prettier formats it (padded tables), so `npm run lint` passes after a run.
  const filled = fillEvalMd(readFileSync(args.evalMd, 'utf8'), block);
  writeFileSync(args.evalMd, await format(filled, { parser: 'markdown' }));
  console.log(`\n${block}\n\nReport: ${path}\nManual: ${MANUAL.join('; ')}`);
}

async function main(): Promise<number> {
  const args = parseEvalArgs(process.argv.slice(2));
  const shots: Shots = { dir: join(args.outDir, 'screenshots'), taken: new Set() };
  mkdirSync(shots.dir, { recursive: true });
  const session = await startSession(args);
  const ctx: Ctx = {
    args,
    session,
    shots,
    file: loadPrompts('docs/eval/prompts.json'),
    rows: [],
    targets: [],
    models: [],
    early: [],
    window: { from: Date.now(), to: Date.now() },
  };
  try {
    const adapter = await adapterOf(await lastPanel(ctx));
    if (!adapter && !args.scripted) {
      console.error('No WebGPU adapter in the panel: run with --scripted for a flow check.');
      return 2;
    }
    for (const key of args.models) await runModelSafely(ctx, key);
    await finish(ctx, adapter);
    return 0;
  } catch (error) {
    // What the last page showed when the eval died (docs/eval/screenshots/failure.png).
    const page = session.context.pages().at(-1);
    if (page)
      await page.screenshot({ path: join(shots.dir, 'failure.png') }).catch(() => undefined);
    throw error;
  } finally {
    await session.close();
  }
}

process.exitCode = await main();
