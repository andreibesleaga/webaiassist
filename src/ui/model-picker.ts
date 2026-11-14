// SPDX-License-Identifier: Apache-2.0
// The model list of the side panel: the four graphics-card models (Gemma 4 E2B only when the
// graphics card has shader-f16), the processor models when
// this browser can run them, Chrome's built-in model when present, the endpoint when one is set, the scripted model in the smoke-test build, and,
// on a computer without WebGPU and nothing else to run, "Set up a chat endpoint".
// Values: "webllm:<id>", "cpu:<id>", "prompt-api", "endpoint", "scripted", "setup-endpoint".
// What is selected: the model the user chose (kept in the Options), else the default that
// src/ui/default-model.ts picks and explains.
import { CPU_MODELS, defaultCpuModelId, findCpuModel, type CpuModel } from '../adapters/cpu-models';
import { isLocalEndpoint } from '../adapters/endpoint-runtime';
import type { GpuSpeed } from '../adapters/gpu-speed';
import {
  defaultModelId,
  modelChoices,
  PROMPT_API_ID,
  SCRIPTED_ID,
  webllmChoices,
} from '../adapters/models';
import type { BuiltInState } from '../adapters/prompt-api-state';
import type { Settings } from '../adapters/settings';
import { chooseDefault, SETUP_VALUE } from './default-model';
import { endpointHost } from './endpoint-host';
import { t } from './i18n';

export { SETUP_VALUE };

export type PickerRuntime = 'webllm' | 'cpu' | 'prompt-api' | 'endpoint' | 'scripted' | 'setup';

/** Where the choice runs: on this computer (in the browser) or on a server, your own or remote.
 *  The list is drawn as one group each, in this order. */
export type PickerGroup = 'local' | 'server';

export const groupLabel = (group: PickerGroup): string =>
  t(group === 'local' ? 'groupLocal' : 'groupServer');

export interface PickerChoice {
  readonly value: string;
  readonly label: string;
  readonly runtime: PickerRuntime;
  readonly modelId: string;
  readonly group: PickerGroup;
}

export interface PickerEnv {
  readonly promptApi: boolean;
  readonly scripted: boolean;
  /** False when the panel's WebGPU probe found no adapter; unknown counts as working. */
  readonly webgpu?: boolean;
  /** False when the WebGPU adapter lacks `shader-f16`, which Gemma 4 E2B needs; unknown counts as present. */
  readonly shaderF16?: boolean;
  /** True when this browser can run the processor models (WebAssembly JSPI and memory64). */
  readonly cpu?: boolean;
  /** Test models of the smoke-test build; empty in the release build. */
  readonly extraCpuModels?: readonly CpuModel[];
  /** "vendor/architecture" of the WebGPU adapter; the key of the measured first answer. */
  readonly gpuKey?: string;
  /** What Chrome says about its built-in model; unknown counts as not ready. */
  readonly builtIn?: BuiltInState;
  /** The measured first answer of this graphics card, when there is one. */
  readonly gpuMeasure?: { readonly speed: GpuSpeed; readonly firstAnswerMs: number };
}

const webllm = (id: string, label: string): PickerChoice => ({
  value: `webllm:${id}`,
  label,
  runtime: 'webllm',
  modelId: id,
  group: 'local',
});

const cpuChoice = (model: CpuModel): PickerChoice => ({
  value: `cpu:${model.id}`,
  label: model.label,
  runtime: 'cpu',
  modelId: model.id,
  group: 'local',
});

const hasEndpoint = (settings: Settings): boolean => settings.endpoint.model !== '';

/** No WebGPU, no processor model, no built-in model and no endpoint: only the set-up can help. */
const needsSetup = (settings: Settings, env: PickerEnv): boolean =>
  env.webgpu === false && env.cpu !== true && !env.promptApi && !hasEndpoint(settings);

/** The endpoint's label says which case it is, from the saved address: a server on this computer
 *  keeps the chat on it; any other address is remote and gets the chat. */
function endpointLabel(url: string, model: string): string {
  const where = isLocalEndpoint(url)
    ? t('endpointLocal')
    : t('endpointRemote', { host: endpointHost(url) });
  return `Endpoint: ${model} at ${url} (${where})`;
}

/** Chrome's built-in model and the scripted test model run on this computer too. */
function localExtras(env: PickerEnv): PickerChoice[] {
  const out: PickerChoice[] = [];
  if (env.promptApi) {
    const label = modelChoices({ promptApi: true }).at(-1)?.label ?? PROMPT_API_ID;
    const group = 'local';
    out.push({ value: 'prompt-api', label, runtime: 'prompt-api', modelId: PROMPT_API_ID, group });
  }
  if (env.scripted) {
    const label = t('scriptedModel');
    const group = 'local';
    out.push({ value: 'scripted', label, runtime: 'scripted', modelId: SCRIPTED_ID, group });
  }
  return out;
}

function serverChoices(settings: Settings, env: PickerEnv): PickerChoice[] {
  const out: PickerChoice[] = [];
  const { url, model } = settings.endpoint;
  const group = 'server';
  if (model !== '') {
    const label = endpointLabel(url, model);
    out.push({ value: 'endpoint', label, runtime: 'endpoint', modelId: model, group });
  }
  if (needsSetup(settings, env)) {
    const label = t('setupEndpoint');
    out.push({ value: SETUP_VALUE, label, runtime: 'setup', modelId: '', group });
  }
  return out;
}

export function pickerChoices(settings: Settings, env: PickerEnv): PickerChoice[] {
  const shipped = webllmChoices(env.shaderF16).map((m) => webllm(m.id, m.label));
  const cpu = env.cpu === true ? [...CPU_MODELS, ...(env.extraCpuModels ?? [])].map(cpuChoice) : [];
  return [...shipped, ...cpu, ...localExtras(env), ...serverChoices(settings, env)];
}

/** The processor model the user chose, or the default when the saved id is not offered. */
function cpuValue(settings: Settings, env: PickerEnv): string {
  const known = findCpuModel(settings.cpuModel, env.extraCpuModels);
  return `cpu:${known?.id ?? defaultCpuModelId()}`;
}

/** The graphics-card model the user chose, when it is still offered (Gemma 4 E2B is not on a
 *  graphics card without `shader-f16`). */
function webllmValue(settings: Settings, env: PickerEnv): string | undefined {
  const id = settings.webllmModel || defaultModelId();
  return webllmChoices(env.shaderF16).some((m) => m.id === id) ? `webllm:${id}` : undefined;
}

/** The model the user chose and saved, when this computer can still run it. */
function chosenValue(settings: Settings, env: PickerEnv): string | undefined {
  switch (settings.runtime) {
    case 'cpu':
      return env.cpu === true ? cpuValue(settings, env) : undefined;
    case 'prompt-api':
      return env.promptApi ? 'prompt-api' : undefined;
    case 'endpoint':
      return hasEndpoint(settings) ? 'endpoint' : undefined;
    case 'webllm':
      return webllmValue(settings, env);
    case 'auto':
      return undefined;
  }
}

export function selectedValue(settings: Settings, env: PickerEnv): string {
  return chosenValue(settings, env) ?? chooseDefault(settings, env).value;
}

export function settingsFor(settings: Settings, value: string): Settings {
  if (value.startsWith('webllm:')) {
    return { ...settings, runtime: 'webllm', webllmModel: value.slice('webllm:'.length) };
  }
  if (value.startsWith('cpu:')) {
    return { ...settings, runtime: 'cpu', cpuModel: value.slice('cpu:'.length) };
  }
  if (value === 'prompt-api' || value === 'endpoint') return { ...settings, runtime: value };
  return settings;
}
