// SPDX-License-Identifier: Apache-2.0
// `npm run eval:nano`: Chrome's built-in model (Gemini Nano) for real, in Google Chrome with
// the eval build of the extension. It records what Chrome says about the model, the default
// the panel picks, the download from the click (with one Cancel on the way when the model is
// not on the computer yet), the start, the prompts of docs/eval/prompts.json on the stub node
// and on the live node, and a second start. The report is docs/eval/EVAL-NANO-<date>.json.
// Run it on a computer with Google Chrome (from WSL: `npm run eval:nano:win`). The profile is
// kept between runs, because Chrome stores its model there (several gigabytes, once).
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEvalArgs } from './args.ts';
import { openStubPanel } from './cpu-run.ts';
import { chromeArgs, nanoVerdict } from './nano-plan.ts';
import { ask, modelStatus, pageTools, pressStart, startModel, type StartResult } from './panel.ts';
import { loadPrompts, promptsFor, type EvalPrompt } from './prompts.ts';
import { scorePrompt, type Row } from './score.ts';
import { EVAL_DIST, startSession, type EvalSession, type Launcher } from './session.ts';

const { values: flags } = parseArgs({
  args: process.argv.slice(2),
  options: {
    prompts: { type: 'string', default: '5' },
    'no-live': { type: 'boolean', default: false },
    'start-timeout': { type: 'string', default: '90' },
  },
});
const PROMPTS = Number(flags.prompts);
const START_TIMEOUT_MIN = Number(flags['start-timeout']);
const PROMPT_TIMEOUT_S = 300;
const args = parseEvalArgs(['--no-cancel-check', '--prompts', String(PROMPTS)]);
const TOOL_NAMES: string[] = (
  JSON.parse(readFileSync('fixtures/agsc-tools.json', 'utf8')) as { tools: { name: string }[] }
).tools.map((t) => t.name);

const profile = (): string =>
  process.env.WEBAIASSIST_NANO_PROFILE ?? join(tmpdir(), 'webaiassist-nano-profile');

/** Google Chrome with its own flags; the extension goes in over the debugging pipe. */
const launchChrome: Launcher = async () => {
  const context = await chromium.launchPersistentContext(profile(), {
    channel: 'chrome',
    headless: false,
    viewport: null,
    ignoreDefaultArgs: true,
    args: chromeArgs(profile()),
  });
  const browser = context.browser();
  if (!browser) throw new Error('no browser handle: cannot load the extension');
  const cdp = await browser.newBrowserCDPSession();
  const loaded = (await cdp.send(
    'Extensions.loadUnpacked' as never,
    {
      path: EVAL_DIST,
    } as never,
  )) as { id: string };
  return { context, extensionId: loaded.id };
};

/** What Chrome answers for the text model in English: "available", "downloadable", ... */
function availability(panel: Page): Promise<string> {
  return panel.evaluate(async () => {
    const api = (globalThis as { LanguageModel?: { availability(o: unknown): Promise<string> } })
      .LanguageModel;
    if (!api) return 'no LanguageModel in this browser';
    const text = [{ type: 'text', languages: ['en'] }];
    try {
      return await api.availability({ expectedInputs: text, expectedOutputs: text });
    } catch (error) {
      return `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
}

interface Picked {
  readonly value: string;
  readonly why: string;
  readonly builtInLine: string;
}

async function picked(panel: Page): Promise<Picked> {
  const text = async (id: string): Promise<string> =>
    ((await panel.locator(id).first().textContent()) ?? '').trim();
  return {
    value: await panel.locator('#model').inputValue(),
    why: await text('#model-why'),
    builtInLine: await text('#builtin-state'),
  };
}

interface CancelSeen {
  readonly saidCancelled: boolean;
  readonly startUsable: boolean;
}

/** Only when the model still has to download: Download, five seconds, Cancel. */
async function cancelOnce(panel: Page): Promise<CancelSeen> {
  await pressStart(panel);
  await panel.waitForTimeout(5_000);
  await panel.click('#cancel-load');
  const seen = (selector: string, has?: string): Promise<boolean> =>
    panel
      .locator(selector)
      .filter(has === undefined ? {} : { hasText: has })
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
  return {
    saidCancelled: await seen('#model-status', 'cancelled'),
    startUsable: await seen('button#start:enabled'),
  };
}

interface NanoStart extends StartResult {
  readonly texts: readonly string[];
}

async function startNano(panel: Page): Promise<NanoStart> {
  await panel.selectOption('#model', 'prompt-api');
  const texts = new Set<string>();
  const watch = setInterval(() => void modelStatus(panel).then((text) => texts.add(text)), 1_000);
  const result = await startModel(panel, START_TIMEOUT_MIN);
  clearInterval(watch);
  texts.add(result.status);
  return { ...result, texts: [...texts] };
}

async function freshPanel(panel: Page): Promise<void> {
  await panel.reload();
  await panel.locator('#page-status').filter({ hasNotText: 'No page yet.' }).waitFor();
  await startNano(panel);
}

async function askAll(
  panel: Page,
  prompts: readonly EvalPrompt[],
  target: 'stub' | 'live',
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const prompt of prompts) {
    const seen = await ask(panel, prompt.text, PROMPT_TIMEOUT_S);
    const row = scorePrompt(prompt, seen, { model: 'nano', target, pageTools: TOOL_NAMES });
    console.log(
      `  ${target} #${prompt.n}: tools [${row.tools.join(', ')}] ${row.totalS} s${row.error === undefined ? '' : ` ERROR ${row.error}`}: ${seen.answer.slice(0, 160)}`,
    );
    rows.push(row);
    await freshPanel(panel);
  }
  return rows;
}

/** The live node in its own tab and panel; an empty list with the reason when it has no tools. */
async function liveRows(session: EvalSession): Promise<{ rows: Row[]; skipped?: string }> {
  const file = loadPrompts('docs/eval/prompts.json');
  const url = file.targets.live?.url;
  if (flags['no-live'] || url === undefined) return { rows: [], skipped: '--no-live' };
  try {
    const { tabId } = await session.openTarget(url);
    const panel = await session.openPanelFor(tabId);
    for (let i = 0; i < 40 && (await pageTools(panel)) === 0; i++) await panel.waitForTimeout(500);
    if ((await pageTools(panel)) === 0) return { rows: [], skipped: 'no WebMCP tools after 20 s' };
    const start = await startNano(panel);
    if (!start.ready) return { rows: [], skipped: `not ready: ${start.status}` };
    return { rows: await askAll(panel, promptsFor(file, 'live', PROMPTS), 'live') };
  } catch (error) {
    return { rows: [], skipped: error instanceof Error ? error.message : String(error) };
  }
}

function writeNanoReport(body: Record<string, unknown> & { chrome: string }): string {
  const date = new Date().toISOString().slice(0, 10);
  const report = { date, os: `${process.platform} ${release()}`, ...body };
  mkdirSync('docs/eval', { recursive: true });
  const path = join('docs/eval', `EVAL-NANO-${date}-${body.chrome}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}

async function main(): Promise<number> {
  const session = await startSession(args, launchChrome);
  try {
    const panel = await openStubPanel(session);
    const before = await availability(panel);
    const choice = await picked(panel);
    console.log(`Chrome ${session.chromeVersion}; built-in model: ${before}`);
    console.log(`default: ${choice.value} (${choice.why})`);
    await panel.selectOption('#model', 'prompt-api');
    const cancel = before === 'downloadable' ? await cancelOnce(panel) : undefined;
    if (cancel) console.log(`cancel: ${JSON.stringify(cancel)}`);
    const start = await startNano(panel);
    console.log(`start: ${start.status} (${start.loadS} s)`);
    const after = await availability(panel);
    const file = loadPrompts('docs/eval/prompts.json');
    const stub = start.ready ? await askAll(panel, promptsFor(file, 'stub', PROMPTS), 'stub') : [];
    const live = start.ready ? await liveRows(session) : { rows: [], skipped: 'not ready' };
    if (live.skipped !== undefined) console.log(`  live: skipped (${live.skipped})`);
    const again = start.ready ? await startNano(await openStubPanel(session)) : undefined;
    const rows = [...stub, ...live.rows];
    const verdict = nanoVerdict({ ready: start.ready, rows });
    const path = writeNanoReport({
      chrome: session.chromeVersion,
      availability: { before, after },
      picked: choice,
      cancel,
      start,
      secondStart: again,
      rows,
      liveSkipped: live.skipped,
      verdict,
    });
    console.log(`${verdict.line}\nReport: ${path}`);
    return verdict.ok ? 0 : 1;
  } finally {
    await session.close();
  }
}

process.exitCode = await main();
