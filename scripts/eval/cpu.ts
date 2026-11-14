// SPDX-License-Identifier: Apache-2.0
// `npm run eval:cpu`: the real CPU runtime (llama.cpp in WebAssembly) with the real default
// model in headless Chromium, five prompts on the stub node. It uses the network (the model
// downloads from Hugging Face on the first run), so it is not part of the gate. Then it starts
// the browser again on the same profile and measures the start from the stored copy.
// Writes docs/eval/EVAL-CPU-<date>.json and prints the numbers.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { release } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEvalArgs } from './args.ts';
import {
  askCpu,
  cancelCheck,
  cpuKey,
  openStubPanel,
  startCpu,
  type CancelResult,
  type CpuAnswer,
  type CpuStart,
} from './cpu-run.ts';
import { loadPrompts, promptsFor } from './prompts.ts';
import { startSession } from './session.ts';

/** `--model 0.6b|1.7b|qwen35-2b` (default 0.6b), `--prompts N` (default 5), `--no-cancel-check`. */
const { values: flags } = parseArgs({
  options: {
    model: { type: 'string', default: '0.6b' },
    prompts: { type: 'string', default: '5' },
    'no-cancel-check': { type: 'boolean', default: false },
  },
  strict: true,
});
const key = cpuKey(flags.model);
const PROMPTS = Number(flags.prompts);
const own = { cancelCheck: !flags['no-cancel-check'] };
const START_TIMEOUT_MIN = 30;
const TOOL_NAMES: string[] = (
  JSON.parse(readFileSync('fixtures/agsc-tools.json', 'utf8')) as { tools: { name: string }[] }
).tools.map((t) => t.name);

interface Report {
  readonly date: string;
  readonly chrome: string;
  readonly os: string;
  readonly cores: number;
  readonly cancel: CancelResult;
  readonly firstStart: CpuStart;
  readonly secondStart: CpuStart | undefined;
  readonly answers: readonly CpuAnswer[];
}

const args = parseEvalArgs([
  '--headless',
  '--no-live',
  '--fresh-profile',
  '--prompts',
  String(PROMPTS),
]);

/** First browser run: download, load, answer the prompts. */
async function firstRun(): Promise<
  Pick<Report, 'chrome' | 'cancel' | 'firstStart' | 'answers' | 'cores'>
> {
  const session = await startSession(args);
  try {
    const panel = await openStubPanel(session);
    const cores = await panel.evaluate(() => navigator.hardwareConcurrency);
    const cancel = await (own.cancelCheck
      ? cancelCheck(panel, key)
      : { answeredMs: null, left: [] });
    console.log(`cancel: answered in ${cancel.answeredMs} ms, files left: ${cancel.left.length}`);
    const firstStart = await startCpu(panel, key, START_TIMEOUT_MIN);
    console.log(`first start: ${firstStart.status} (${firstStart.loadS} s)`);
    const answers: CpuAnswer[] = [];
    if (firstStart.ready) {
      const prompts = promptsFor(loadPrompts('docs/eval/prompts.json'), 'stub', PROMPTS);
      for (const prompt of prompts) {
        const done = await askCpu(panel, prompt, TOOL_NAMES);
        console.log(
          `  #${prompt.n}: tools [${done.row.tools.join(', ')}] ${done.row.totalS} s: ${done.answer}`,
        );
        answers.push(done);
        await panel.reload();
        await panel.locator('#page-status').filter({ hasNotText: 'No page yet.' }).waitFor();
        await startCpu(panel, key, START_TIMEOUT_MIN);
      }
    }
    return { chrome: session.chromeVersion, cancel, firstStart, answers, cores };
  } finally {
    await session.close();
  }
}

/** Second browser run on the same profile: the start from the stored copy. */
async function secondRun(): Promise<CpuStart> {
  const session = await startSession({ ...args, freshProfile: false });
  try {
    const panel = await openStubPanel(session);
    const start = await startCpu(panel, key, START_TIMEOUT_MIN);
    console.log(
      `second start: ${start.status} (${start.loadS} s, downloaded: ${start.downloaded})`,
    );
    return start;
  } finally {
    await session.close();
  }
}

async function main(): Promise<number> {
  const first = await firstRun();
  const secondStart = first.firstStart.ready ? await secondRun() : undefined;
  const report: Report = {
    date: new Date().toISOString().slice(0, 10),
    os: `${process.platform} ${release()}`,
    ...first,
    secondStart,
  };
  mkdirSync('docs/eval', { recursive: true });
  const path = join('docs/eval', `EVAL-CPU-${key}-${report.date}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${path}`);
  return first.firstStart.ready ? 0 : 1;
}

process.exitCode = await main();
