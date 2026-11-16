// SPDX-License-Identifier: Apache-2.0
// The models the picker offers. The four WebLLM ids are records in WebLLM's prebuiltAppConfig
// (version pinned in package.json); GPU memory is its vram_required_MB.

export type RuntimeKind = 'webllm' | 'prompt-api' | 'scripted';

export interface ModelChoice {
  readonly id: string;
  readonly label: string;
  readonly runtime: RuntimeKind;
  /** A WebGPU feature the graphics card must have; the picker lists the model only then. */
  readonly requiredFeature?: 'shader-f16';
}

export const PROMPT_API_ID = 'chrome-built-in';
export const SCRIPTED_ID = 'scripted-test-model';

const SMALL = 'Qwen3-0.6B-q4f16_1-MLC';
const LARGE = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const QWEN35 = 'Qwen3.5-2B-q4f16_1-MLC';
const GEMMA = 'gemma-4-E2B-it-q4f16_1-MLC';

/** Where a graphics-card model runs, as every label says it. */
const ON_GPU = 'in this browser, on your graphics card';

const WEBLLM_MODELS: readonly ModelChoice[] = [
  {
    id: SMALL,
    label: `Qwen3 0.6B (the smallest; ${ON_GPU}; needs about 1.4 GB of GPU memory)`,
    runtime: 'webllm',
  },
  {
    id: QWEN35,
    label: `Qwen3.5 2B (newer, for tools; ${ON_GPU}; 1.1 GB download; needs about 2.3 GB of GPU memory; Apache-2.0)`,
    runtime: 'webllm',
  },
  {
    id: LARGE,
    label: `Llama 3.2 3B (slow: may stall on a laptop graphics card; ${ON_GPU}; needs about 2.3 GB of GPU memory)`,
    runtime: 'webllm',
  },
  {
    id: GEMMA,
    label: `Gemma 4 E2B (slow: may stall on a laptop graphics card; ${ON_GPU}; 2.8 GB download; needs about 3.4 GB of GPU memory; Apache-2.0)`,
    runtime: 'webllm',
    requiredFeature: 'shader-f16',
  },
];

/** Bytes the weights, tokenizer and config of each graphics-card model download: the sum of the
 *  files of the pinned Hugging Face revisions, read from its tree API on 14 Nov 2026. Qwen3 0.6B
 *  and Llama 3.2 3B are the sum of every file of the revision; Qwen3.5 2B and Gemma 4 E2B
 *  are exactly the files WebLLM fetches (weight shards, tensor-cache.json, mlc-chat-config.json,
 *  tokenizer.json, and for Gemma mlc-model-manifest.json). */
export const WEBLLM_DOWNLOADS: Readonly<Record<string, number>> = {
  [SMALL]: 351_517_143,
  [QWEN35]: 1_072_298_012,
  [LARGE]: 1_816_811_105,
  [GEMMA]: 2_830_391_017,
};

/** The graphics-card model "Start" loads when the user has not picked one: the smallest, on
 *  every GPU (measured best on the graphics card, 16 Nov 2026). The other three download only
 *  when the user chooses them; Llama 3.2 3B and Gemma 4 E2B are marked slow and never a default. */
export function defaultModelId(): string {
  return SMALL;
}

export const WEBLLM_MODEL_IDS: readonly string[] = WEBLLM_MODELS.map((m) => m.id);

const PROMPT_API_MODEL: ModelChoice = {
  id: PROMPT_API_ID,
  label:
    "Chrome's built-in model (in Chrome on this computer; optional: Gemini Nano, which Chrome downloads only when you choose it)",
  runtime: 'prompt-api',
};

const SCRIPTED_MODEL: ModelChoice = {
  id: SCRIPTED_ID,
  label: 'Scripted test model (smoke-test build only)',
  runtime: 'scripted',
};

export interface ChoiceOptions {
  /** `LanguageModel` exists in this browser. */
  readonly promptApi: boolean;
  /** The smoke-test build: add the scripted model. */
  readonly scripted?: boolean;
}

export function modelChoices(options: ChoiceOptions): ModelChoice[] {
  return [
    ...WEBLLM_MODELS,
    ...(options.promptApi ? [PROMPT_API_MODEL] : []),
    ...(options.scripted === true ? [SCRIPTED_MODEL] : []),
  ];
}

/** The graphics-card models a computer can run: one that needs `shader-f16` is left out when the
 *  adapter is known to lack it (`false`); unknown (`undefined`) counts as present. */
export function webllmChoices(shaderF16: boolean | undefined): readonly ModelChoice[] {
  return WEBLLM_MODELS.filter((m) => m.requiredFeature === undefined || shaderF16 !== false);
}

export function findModel(id: string): ModelChoice | undefined {
  return [...WEBLLM_MODELS, PROMPT_API_MODEL, SCRIPTED_MODEL].find((m) => m.id === id);
}
