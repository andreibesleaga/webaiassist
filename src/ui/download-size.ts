// SPDX-License-Identifier: Apache-2.0
// How much a first download of a model is and where it comes from, for the question before the
// download and for the "no space" message. The numbers are the records in src/adapters.
import { findCpuModel, findGpuModel } from '../adapters/cpu-models';
import type { PickerChoice, PickerEnv } from './model-picker';

export interface DownloadSource {
  readonly bytes: number;
  readonly host: string;
}

/** Undefined for a choice that downloads nothing of its own (an endpoint, Chrome's model). */
export function downloadBytes(choice: PickerChoice, env: PickerEnv): DownloadSource | undefined {
  if (choice.runtime !== 'webllm' && choice.runtime !== 'cpu') return undefined;
  const find = choice.runtime === 'webllm' ? findGpuModel : findCpuModel;
  const model = find(choice.modelId, env.extraCpuModels);
  return model ? { bytes: model.bytes, host: new URL(model.url).host } : undefined;
}
