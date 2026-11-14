// SPDX-License-Identifier: Apache-2.0
// Which model the panel selects when the user has not chosen one, and the one sentence that says
// why. The order: Chrome's built-in model when it is ready; the graphics card when a stored
// measurement says it is not slow; the processor model; the graphics card, unmeasured, when
// the processor cannot run here; the endpoint; Chrome's built-in model still to download; the
// endpoint set-up. A model the user chose always wins (model-picker.ts), so it never gets here.
import { endpointHost } from './endpoint-host';
import { defaultCpuModelId, findCpuModel } from '../adapters/cpu-models';
import { defaultModelId } from '../adapters/models';
import type { Settings } from '../adapters/settings';
import type { MessageKey } from './messages-en';
import type { PickerEnv } from './model-picker';

/** The picker value of the entry that opens the endpoint settings. */
export const SETUP_VALUE = 'setup-endpoint';

export interface DefaultChoice {
  readonly value: string;
  readonly why: MessageKey;
  readonly values?: Readonly<Record<string, string | number>>;
}

const gpuValue = (): string => `webllm:${defaultModelId()}`;
const cpuValue = (): string => `cpu:${defaultCpuModelId()}`;
const hasEndpoint = (settings: Settings): boolean => settings.endpoint.model !== '';

function cpuChoice(env: PickerEnv): DefaultChoice {
  const model = findCpuModel(defaultCpuModelId(), env.extraCpuModels);
  return { value: cpuValue(), why: 'whyCpu', values: { size: model?.memoryMb ?? 0 } };
}

function gpuChoice(env: PickerEnv): DefaultChoice {
  const seconds = Math.round((env.gpuMeasure?.firstAnswerMs ?? 0) / 1000);
  return { value: gpuValue(), why: 'whyGpu', values: { seconds } };
}

/** What is left when neither a ready built-in model, a quick graphics card nor the processor
 *  model can be used. */
function lastResort(settings: Settings, env: PickerEnv): DefaultChoice {
  if (hasEndpoint(settings)) {
    const values = { host: endpointHost(settings.endpoint.url) };
    return { value: 'endpoint', why: 'whyEndpoint', values };
  }
  if (env.promptApi) return { value: 'prompt-api', why: 'whyBuiltInLast' };
  return { value: SETUP_VALUE, why: 'whySetup' };
}

export function chooseDefault(settings: Settings, env: PickerEnv): DefaultChoice {
  const gpuWorks = env.webgpu !== false;
  if (env.promptApi && env.builtIn === 'available') {
    return { value: 'prompt-api', why: 'whyBuiltIn' };
  }
  if (gpuWorks && env.gpuMeasure?.speed === 'fast') return gpuChoice(env);
  if (env.cpu === true) return cpuChoice(env);
  if (gpuWorks) return { value: gpuValue(), why: 'whyGpuOnly' };
  return lastResort(settings, env);
}

/** The reason line for `value`, which is the model the picker shows as selected. */
export function whyFor(settings: Settings, env: PickerEnv, value: string): DefaultChoice {
  if (value === 'scripted') return { value, why: 'whyTest' };
  if (value === SETUP_VALUE) return { value, why: 'whySetup' };
  const fallback = chooseDefault(settings, env);
  if (settings.runtime === 'auto' && fallback.value === value) return fallback;
  return { value, why: 'whyChosen' };
}
