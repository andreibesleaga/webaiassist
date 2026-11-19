// SPDX-License-Identifier: Apache-2.0
// Command line of `npm run eval:gpu` (scripts/eval/run.ts). See docs/EVAL.md, "Run".
import { parseArgs } from 'node:util';

export type ModelKey = 'qwen' | 'qwen17' | 'llama' | 'qwen35' | 'gemma4' | 'scripted';

export interface EvalArgs {
  readonly models: readonly ModelKey[];
  readonly prompts: number;
  readonly idleMinutes: number;
  readonly scripted: boolean;
  readonly headless: boolean;
  /** Playwright's bundled Chromium: Google Chrome and Edge no longer accept the flags that side-load an unpacked extension (Playwright, "Chrome extensions"). */
  readonly channel: 'chromium';
  readonly live: boolean;
  /** Skip the Cancel check (a Start cancelled after 5 s): to tell its effect on the GPU apart. */
  readonly cancelCheck: boolean;
  readonly freshProfile: boolean;
  /** Start the browser with its switch for the faster graphics card. On a laptop with two
   *  cards the browser otherwise gives pages the integrated one, whatever they ask for
   *  (measured 18 Nov 2026: AMD integrated by default, NVIDIA only with the switch). */
  readonly fastGpu: boolean;
  /** Keep what the extension remembers of each site between questions (as a person with memory
   *  on would): to measure the effect of a saved chat. Off by default: every question starts new. */
  readonly keepChat: boolean;
  readonly outDir: string;
  readonly evalMd: string;
  readonly promptTimeoutS: number;
  readonly startTimeoutMin: number;
}

export const MODEL_IDS: Readonly<Record<ModelKey, string>> = {
  qwen: 'qwen3-0.6b-q4_k_m',
  qwen17: 'qwen3-1.7b-q4_k_m',
  llama: 'llama-3.2-3b-instruct-q4_k_m',
  qwen35: 'qwen3.5-2b-q4_k_m',
  gemma4: 'gemma-4-e2b-it-q4_k_m',
  scripted: 'scripted',
};

const OPTIONS = {
  // One model per run: a second model in the same run sees the first one's saved chat and
  // copies its answers (seen on 18 Nov 2026). The default is the model the panel picks.
  models: { type: 'string', default: 'qwen17' },
  prompts: { type: 'string', default: '20' },
  idle: { type: 'string', default: '10' },
  scripted: { type: 'boolean', default: false },
  headless: { type: 'boolean', default: false },
  'no-live': { type: 'boolean', default: false },
  'no-cancel-check': { type: 'boolean', default: false },
  'fresh-profile': { type: 'boolean', default: false },
  'fast-gpu': { type: 'boolean', default: false },
  'keep-chat': { type: 'boolean', default: false },
  out: { type: 'string', default: 'docs/eval' },
  'eval-md': { type: 'string', default: 'docs/EVAL.md' },
  'prompt-timeout': { type: 'string', default: '300' },
  'start-timeout': { type: 'string', default: '20' },
} as const;

/** The graphics-card models `--models` takes, by their short names. */
const REAL_MODELS: readonly ModelKey[] = ['qwen', 'qwen17', 'llama', 'qwen35', 'gemma4'];

function models(text: string, scripted: boolean): ModelKey[] {
  if (scripted) return ['scripted'];
  return text.split(',').map((name) => {
    const key = REAL_MODELS.find((known) => known === name);
    if (key === undefined) throw new Error(`unknown model "${name}" (${REAL_MODELS.join(', ')})`);
    return key;
  });
}

function count(text: string, name: string, min: number, max = Infinity): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      max === Infinity ? `${name} must be ${min} or more` : `${name} must be ${min} to ${max}`,
    );
  }
  return value;
}

export function parseEvalArgs(argv: readonly string[]): EvalArgs {
  const { values: v } = parseArgs({ args: [...argv], options: OPTIONS, strict: true });
  return {
    models: models(v.models, v.scripted),
    prompts: count(v.prompts, '--prompts', 1, 20),
    idleMinutes: count(v.idle, '--idle', 0),
    scripted: v.scripted,
    headless: v.headless,
    channel: 'chromium',
    live: !v['no-live'],
    cancelCheck: !v['no-cancel-check'],
    freshProfile: v['fresh-profile'],
    fastGpu: v['fast-gpu'],
    keepChat: v['keep-chat'],
    outDir: v.out,
    evalMd: v['eval-md'],
    promptTimeoutS: count(v['prompt-timeout'], '--prompt-timeout', 10),
    startTimeoutMin: count(v['start-timeout'], '--start-timeout', 1),
  };
}
