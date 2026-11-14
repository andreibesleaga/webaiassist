// SPDX-License-Identifier: Apache-2.0
// The pieces of `npm run eval:cpu` (scripts/eval/cpu.ts): start the CPU model in the side
// panel, ask prompts on the stub node, and collect the engine's speed lines from the console.
import type { Page } from '@playwright/test';
import { ask, modelStatus, pageTools, pressStart, startModel, type StartResult } from './panel.ts';
import type { EvalPrompt } from './prompts.ts';
import { scorePrompt, type Row } from './score.ts';
import type { EvalSession } from './session.ts';

/** The `--model` names of `npm run eval:cpu` and the id of the processor model each one runs. */
export const CPU_KEYS = {
  '0.6b': 'qwen3-0.6b-q4_k_m',
  '1.7b': 'qwen3-1.7b-q4_k_m',
  'qwen35-2b': 'qwen3.5-2b-q4_k_m',
} as const;

export type CpuKey = keyof typeof CPU_KEYS;

/** The `--model` value, "0.6b" when none is given; an unknown name is an error, not a default. */
export function cpuKey(text: string | undefined): CpuKey {
  if (text === undefined) return '0.6b';
  if (text in CPU_KEYS) return text as CpuKey;
  throw new Error(`unknown model "${text}" (${Object.keys(CPU_KEYS).join(', ')})`);
}

/** The panel's value for a CPU model. */
export const cpuChoice = (key: CpuKey): string => `cpu:${CPU_KEYS[key]}`;

export interface Speed {
  readonly promptTokens: number;
  readonly promptPerSecond: number;
  readonly replyTokens: number;
  readonly replyPerSecond: number;
}

export interface CpuStart extends StartResult {
  readonly downloaded: boolean;
  readonly texts: readonly string[];
}

export interface CpuAnswer {
  readonly row: Row;
  readonly answer: string;
  readonly speeds: readonly Speed[];
}

const round = (value: number | undefined): number => Math.round((value ?? 0) * 10) / 10;

/** The engine keeps the timings of each reply in localStorage in the measuring builds. */
const TIMINGS_KEY = 'webaiassist.cpu-timings';

export function parseSpeed(t: Record<string, number>): Speed {
  return {
    promptTokens: t.prompt_n ?? 0,
    promptPerSecond: round(t.prompt_per_second),
    replyTokens: t.predicted_n ?? 0,
    replyPerSecond: round(t.predicted_per_second),
  };
}

/** Every reply's timings so far, read from the extension's storage through the panel page. */
export async function readSpeeds(panel: Page): Promise<Speed[]> {
  const raw = await panel.evaluate((key) => localStorage.getItem(key), TIMINGS_KEY);
  const list = raw === null ? [] : (JSON.parse(raw) as Record<string, number>[]);
  return list.map(parseSpeed);
}

/** Opens the stub node and its panel and waits until the panel lists the page tools. */
export async function openStubPanel(session: EvalSession): Promise<Page> {
  const { tabId } = await session.openTarget(`${session.stubUrl}/`);
  const panel = await session.openPanelFor(tabId);
  for (let i = 0; i < 20 && (await pageTools(panel)) === 0; i++) await panel.waitForTimeout(500);
  return panel;
}

/** Chooses the CPU model and presses Start; records the progress texts it went through. */
export async function startCpu(panel: Page, key: CpuKey, timeoutMin: number): Promise<CpuStart> {
  await panel.selectOption('#model', cpuChoice(key));
  const texts = new Set<string>();
  const watch = setInterval(() => void modelStatus(panel).then((text) => texts.add(text)), 500);
  const result = await startModel(panel, timeoutMin);
  clearInterval(watch);
  texts.add(result.status);
  const seen = [...texts];
  return {
    ...result,
    downloaded: seen.some((text) => text.startsWith('Downloading')),
    texts: seen,
  };
}

export interface CancelResult {
  /** Milliseconds from the Cancel press until the model line said the download was cancelled. */
  readonly answeredMs: number | null;
  /** Files left in the model cache after the cancel (should be none). */
  readonly left: readonly string[];
}

/** The files in the extension's model cache (wllama keeps them in the private file storage). */
export function cachedFiles(panel: Page): Promise<string[]> {
  return panel.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('cache', { create: true });
    const names: string[] = [];
    for await (const [name] of (
      dir as unknown as { entries(): AsyncIterable<[string, unknown]> }
    ).entries()) {
      names.push(name);
    }
    return names;
  });
}

/** Starts the download, presses Cancel a few seconds in, and measures how fast it ends. */
export async function cancelCheck(panel: Page, key: CpuKey): Promise<CancelResult> {
  await panel.selectOption('#model', cpuChoice(key));
  await pressStart(panel);
  await panel
    .locator('#model-status')
    .filter({ hasText: 'Downloading' })
    .waitFor({ timeout: 60_000 });
  await panel.waitForTimeout(3_000);
  const pressed = performance.now();
  await panel.click('#cancel-load');
  const answered = await panel
    .locator('#model-status')
    .filter({ hasText: 'cancelled' })
    .waitFor({ timeout: 10_000 })
    .then(() => Math.round(performance.now() - pressed))
    .catch(() => null);
  await panel.waitForTimeout(1_000);
  return { answeredMs: answered, left: await cachedFiles(panel) };
}

/** One prompt: asked through the panel, scored like the GPU eval, with the speed lines it caused. */
export async function askCpu(
  panel: Page,
  prompt: EvalPrompt,
  pageTools: readonly string[],
): Promise<CpuAnswer> {
  const before = (await readSpeeds(panel)).length;
  const seen = await ask(panel, prompt.text, 600);
  const row = scorePrompt(prompt, seen, { model: 'cpu', target: 'stub', pageTools });
  return { row, answer: seen.answer, speeds: (await readSpeeds(panel)).slice(before) };
}
