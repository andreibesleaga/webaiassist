// SPDX-License-Identifier: Apache-2.0
// Command line of `npm run eval:gpu` (scripts/eval/run.ts). See docs/EVAL.md, "Run".
import { parseArgs } from 'node:util';

export type ModelKey = 'qwen' | 'llama' | 'qwen35' | 'gemma4' | 'scripted';

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
  readonly outDir: string;
  readonly evalMd: string;
  readonly promptTimeoutS: number;
  readonly startTimeoutMin: number;
}

export const MODEL_IDS: Readonly<Record<ModelKey, string>> = {
  qwen: 'Qwen3-0.6B-q4f16_1-MLC',
  llama: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  qwen35: 'Qwen3.5-2B-q4f16_1-MLC',
  gemma4: 'gemma-4-E2B-it-q4f16_1-MLC',
  scripted: 'scripted',
};

const OPTIONS = {
  models: { type: 'string', default: 'qwen,llama' },
  prompts: { type: 'string', default: '20' },
  idle: { type: 'string', default: '10' },
  scripted: { type: 'boolean', default: false },
  headless: { type: 'boolean', default: false },
  'no-live': { type: 'boolean', default: false },
  'no-cancel-check': { type: 'boolean', default: false },
  'fresh-profile': { type: 'boolean', default: false },
  out: { type: 'string', default: 'docs/eval' },
  'eval-md': { type: 'string', default: 'docs/EVAL.md' },
  'prompt-timeout': { type: 'string', default: '300' },
  'start-timeout': { type: 'string', default: '20' },
} as const;

function models(text: string, scripted: boolean): ModelKey[] {
  if (scripted) return ['scripted'];
  return text.split(',').map((name) => {
    if (name !== 'qwen' && name !== 'llama' && name !== 'qwen35' && name !== 'gemma4')
      throw new Error(`unknown model "${name}" (qwen, llama, qwen35, gemma4)`);
    return name;
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
    outDir: v.out,
    evalMd: v['eval-md'],
    promptTimeoutS: count(v['prompt-timeout'], '--prompt-timeout', 10),
    startTimeoutMin: count(v['start-timeout'], '--start-timeout', 1),
  };
}
