// SPDX-License-Identifier: Apache-2.0
// How much a first download of a model is and where it comes from, for the question before the
// download and for the "no space" message. The numbers are the records in src/adapters.
import { findCpuModel } from '../adapters/cpu-models';
import { WEBLLM_DOWNLOADS } from '../adapters/models';
import type { PickerChoice, PickerEnv } from './model-picker';

export interface DownloadSource {
  readonly bytes: number;
  readonly host: string;
}

/** Undefined for a choice that downloads nothing of its own (an endpoint, Chrome's model). */
export function downloadBytes(choice: PickerChoice, env: PickerEnv): DownloadSource | undefined {
  if (choice.runtime === 'webllm') {
    return { bytes: WEBLLM_DOWNLOADS[choice.modelId] ?? 0, host: 'huggingface.co' };
  }
  if (choice.runtime !== 'cpu') return undefined;
  const model = findCpuModel(choice.modelId, env.extraCpuModels);
  return model ? { bytes: model.bytes, host: new URL(model.url).host } : undefined;
}
