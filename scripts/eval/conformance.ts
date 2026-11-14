// SPDX-License-Identifier: Apache-2.0
// `npm run eval:conformance [-- --extension] [--demos] [--no-browser]`: the WebMCP conformance page
// in real Google Chrome (from WSL: `npm run eval:conformance:win`).
//   stage 1 (default)  Chrome alone: conformance/index.html?case=all&mode=self, the page's own checks
//   --extension        Chrome with the eval build: every case of conformance/expect.json through the
//                      real side panel with the scripted model (scripts/eval/conformance-run.ts)
//   --demos            Google's official demo pages (needs the build with the demo host, made here)
// The report is docs/eval/EVAL-CONFORMANCE-<date>-<chrome>.json. Chrome 157 needs
// --enable-features=WebMCP, which scripts/eval/nano-plan.ts#chromeArgs already passes.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEvalArgs } from './args.ts';
import { launchChrome } from './chrome-launch.ts';
import { loadExpect } from './conformance-expect.ts';
import { browserLine, extensionLine, type StageResult } from './conformance-report.ts';
import { runExtensionCase, type Checked } from './conformance-run.ts';
import { startConformanceServer } from './conformance-server.ts';
import { runDemos } from './demos.ts';
import { EVAL_DIST, startSession } from './session.ts';

const { values: flags } = parseArgs({
  args: process.argv.slice(2),
  options: {
    extension: { type: 'boolean', default: false },
    demos: { type: 'boolean', default: false },
    'no-browser': { type: 'boolean', default: false },
  },
});

const profile = (): string =>
  process.env.WEBAIASSIST_CONFORMANCE_PROFILE ?? join(tmpdir(), 'webaiassist-conformance-profile');

interface PageReport {
  readonly userAgent: string;
  readonly features: Record<string, boolean>;
  readonly results: { id: string; title: string; status: string; detail: string }[];
}

/** Stage 1: Chrome without the extension runs the page's own checks on every case. */
async function browserStage(chrome: {
  version: string;
}): Promise<{ report: PageReport; stage: StageResult }> {
  const server = await startConformanceServer();
  const { context } = await launchChrome({ profile: profile() });
  try {
    chrome.version = context.browser()?.version() ?? 'unknown';
    const page = await context.newPage();
    const other = encodeURIComponent(`${server.otherOrigin}/`);
    await page.goto(`${server.origin}/index.html?case=all&mode=self&other=${other}`);
    await page.waitForFunction(
      () => (window as unknown as { __conformance: { done: boolean } }).__conformance.done,
      null,
      { timeout: 120_000 },
    );
    const report = await page.evaluate(() =>
      (window as unknown as { __conformance: { report(): unknown } }).__conformance.report(),
    );
    const typed = report as PageReport;
    return { report: typed, stage: browserLine(typed.results) };
  } finally {
    await context.close();
    await server.close();
  }
}

/** Stage 2: the eval build in Chrome, every case through the panel. */
async function extensionStage(chrome: {
  version: string;
}): Promise<{ perCase: Record<string, Checked[]>; stage: StageResult }> {
  const server = await startConformanceServer();
  const launch = (): ReturnType<typeof launchChrome> =>
    launchChrome({ profile: profile(), extension: EVAL_DIST });
  const session = await startSession(parseEvalArgs([]), launch);
  const perCase: Record<string, Checked[]> = {};
  try {
    chrome.version = session.chromeVersion;
    for (const [id, expected] of Object.entries(loadExpect().cases)) {
      const { page, tabId } = await session.openTarget(
        `${server.origin}/index.html?case=${id}&other=${encodeURIComponent(`${server.otherOrigin}/`)}`,
      );
      const panel = await session.openPanelFor(tabId);
      perCase[id] = await runExtensionCase(panel, page, expected).catch((error: unknown) => [
        { step: 'run', ok: false, detail: String(error) },
      ]);
      console.log(`  ${id}: ${perCase[id]?.every((c) => c.ok) ? 'ok' : 'NOT AS EXPECTED'}`);
      await panel.close();
      await page.close();
    }
  } finally {
    await session.close();
    await server.close();
  }
  return { perCase, stage: extensionLine(perCase) };
}

/** Stage 3: the demo pages; the eval build with the demo host is made first. */
async function demosStage(chrome: {
  version: string;
}): Promise<{ rows: Awaited<ReturnType<typeof runDemos>>; stage: StageResult }> {
  for (const command of [
    ['scripts/build.mjs', '--demos'],
    ['scripts/check-dist.mjs', '--eval', '--demos'],
  ]) {
    const built = spawnSync(process.execPath, command, { stdio: 'inherit' });
    if (built.status !== 0) throw new Error(`${command.join(' ')} failed`);
  }
  const launch = (): ReturnType<typeof launchChrome> =>
    launchChrome({ profile: profile(), extension: EVAL_DIST });
  const session = await startSession(parseEvalArgs([]), launch);
  try {
    chrome.version = session.chromeVersion;
    const rows = await runDemos(session);
    const found = rows.filter((row) => row.tools.length > 0).length;
    return {
      rows,
      stage: {
        stage: 'demos',
        ok: true,
        line: `demos: ${found} of ${rows.length} pages registered tools`,
      },
    };
  } finally {
    await session.close();
  }
}

function writeReport(chrome: string, body: Record<string, unknown>): string {
  const date = new Date().toISOString().slice(0, 10);
  mkdirSync('docs/eval', { recursive: true });
  const path = join('docs/eval', `EVAL-CONFORMANCE-${date}-${chrome}.json`);
  writeFileSync(
    path,
    `${JSON.stringify({ date, os: `${process.platform} ${release()}`, chrome, ...body }, null, 2)}\n`,
  );
  return path;
}

async function main(): Promise<number> {
  const chrome = { version: 'unknown' };
  const stages: StageResult[] = [];
  const body: Record<string, unknown> = {};
  if (!flags['no-browser']) {
    const done = await browserStage(chrome);
    stages.push(done.stage);
    body.browser = done.report;
  }
  if (flags.extension) {
    const done = await extensionStage(chrome);
    stages.push(done.stage);
    body.extension = done.perCase;
  }
  if (flags.demos) {
    const done = await demosStage(chrome);
    stages.push(done.stage);
    body.demos = done.rows;
  }
  const path = writeReport(chrome.version, { ...body, stages });
  for (const stage of stages) console.log(stage.line);
  console.log(`Report: ${path}`);
  return stages.every((stage) => stage.ok) ? 0 : 1;
}

process.exitCode = await main();
