// SPDX-License-Identifier: Apache-2.0
// The models the picker offers. The graphics-card models are the GGUF records of
// src/adapters/cpu-models.ts, run by llama.cpp with every layer on the graphics card.
// "webllm" is the name version 0.1.0 stored for the graphics-card choice (it then used another
// engine); the stored name stays so that saved settings keep working.
import { defaultGpuModelId, GPU_MODELS } from './cpu-models';

export type RuntimeKind = 'webllm' | 'prompt-api' | 'scripted';

export interface ModelChoice {
  readonly id: string;
  readonly label: string;
  readonly runtime: RuntimeKind;
  /** A WebGPU feature the graphics card must have; the picker lists the model only then.
   *  No model needs one today. */
  readonly requiredFeature?: 'shader-f16';
}

export const PROMPT_API_ID = 'chrome-built-in';
export const SCRIPTED_ID = 'scripted-test-model';

const WEBLLM_MODELS: readonly ModelChoice[] = GPU_MODELS.map((model) => ({
  id: model.id,
  label: model.label,
  runtime: 'webllm',
}));

/** Bytes each graphics-card model downloads: its one GGUF file. */
export const WEBLLM_DOWNLOADS: Readonly<Record<string, number>> = Object.fromEntries(
  GPU_MODELS.map((model) => [model.id, model.bytes]),
);

/** The graphics-card model "Start" loads when the user has not picked one (cpu-models.ts). The
 *  others download only when the user chooses them; Llama 3.2 3B and Gemma 4 E2B are never a
 *  default, and Gemma 4 E2B is marked slow (1 to 2 minutes a question on the measured laptop). */
export function defaultModelId(): string {
  return defaultGpuModelId();
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
