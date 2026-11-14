// SPDX-License-Identifier: Apache-2.0
// Moves Settings into the Options form and back. The form keeps no state of its own.
import { CPU_MODELS } from '../adapters/cpu-models';
import { endpointUrlProblem } from '../adapters/endpoint-runtime';
import { webllmChoices } from '../adapters/models';
import { ENDPOINT_PRESETS, normalizeSettings, type Settings } from '../adapters/settings';
import { byId, element } from './dom';
import { t } from './i18n';

const input = (doc: Document, id: string) => byId<HTMLInputElement>(doc, id);
const select = (doc: Document, id: string) => byId<HTMLSelectElement>(doc, id);

function option(doc: Document, value: string, label: string): HTMLOptionElement {
  const node = element(doc, 'option', label);
  node.value = value;
  return node;
}

/** The model name without its details: "Qwen3 0.6B on the processor". */
const nameOf = (label: string): string => label.split(' (')[0] ?? label;

/** Fills the lists whose entries come from code: models and endpoint presets. `shaderF16` is
 *  what the graphics card reports (unknown: undefined); a model that needs it is left out
 *  when it lacks it. */
export function buildLists(doc: Document, shaderF16?: boolean): void {
  const [small] = CPU_MODELS;
  byId(doc, 'rt-cpu-help').textContent = t('runtimeCpuHelp', {
    size: Math.round((small?.bytes ?? 0) / 1_000_000),
  });
  select(doc, 'cpu-model').replaceChildren(
    option(doc, '', t('automatic')),
    ...CPU_MODELS.map((m) => option(doc, m.id, nameOf(m.label))),
  );
  select(doc, 'webllm-model').replaceChildren(
    option(doc, '', t('automatic')),
    ...webllmChoices(shaderF16).map((m) => option(doc, m.id, m.label)),
  );
  select(doc, 'endpoint-preset').replaceChildren(
    ...ENDPOINT_PRESETS.map((p) => option(doc, p.url, p.name)),
    option(doc, '', t('presetCustom')),
  );
}

function checkRadio(doc: Document, name: string, value: string): void {
  doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function radioValue(doc: Document, name: string): string | undefined {
  return doc.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

export function fillForm(doc: Document, settings: Settings): void {
  checkRadio(doc, 'runtime', settings.runtime);
  checkRadio(doc, 'confirm', settings.confirmMode);
  select(doc, 'webllm-model').value = settings.webllmModel;
  select(doc, 'cpu-model').value = settings.cpuModel;
  const preset = ENDPOINT_PRESETS.some((p) => p.url === settings.endpoint.url);
  select(doc, 'endpoint-preset').value = preset ? settings.endpoint.url : '';
  input(doc, 'endpoint-url').value = settings.endpoint.url;
  input(doc, 'endpoint-model').value = settings.endpoint.model;
  input(doc, 'endpoint-key').value = settings.endpoint.apiKey;
  input(doc, 'endpoint-context').value = String(settings.endpoint.contextTokens);
  input(doc, 'max-steps').value = String(settings.maxSteps);
  input(doc, 'memory').checked = settings.memory;
  input(doc, 'site-facts').checked = settings.siteFacts;
  select(doc, 'language').value = settings.language;
}

export function readForm(doc: Document): Settings {
  return normalizeSettings({
    runtime: radioValue(doc, 'runtime'),
    confirmMode: radioValue(doc, 'confirm'),
    webllmModel: select(doc, 'webllm-model').value,
    cpuModel: select(doc, 'cpu-model').value,
    endpoint: {
      url: input(doc, 'endpoint-url').value.trim(),
      model: input(doc, 'endpoint-model').value.trim(),
      apiKey: input(doc, 'endpoint-key').value,
      contextTokens: Number(input(doc, 'endpoint-context').value),
    },
    maxSteps: Number(input(doc, 'max-steps').value),
    memory: input(doc, 'memory').checked,
    siteFacts: input(doc, 'site-facts').checked,
    language: select(doc, 'language').value,
  });
}

/** Shows the fields of the chosen runtime only: the model list of that runtime, or the endpoint. */
export function syncVisibility(doc: Document): void {
  const runtime = radioValue(doc, 'runtime');
  byId(doc, 'cpu-model-field').hidden = runtime !== 'cpu';
  byId(doc, 'webllm-model-field').hidden = runtime !== 'webllm';
  byId(doc, 'endpoint-fields').hidden = runtime !== 'endpoint';
}

/** Why an endpoint setting cannot be saved, or undefined when it can. */
export function endpointProblem(settings: Settings): string | undefined {
  if (settings.runtime !== 'endpoint') return undefined;
  const bad = endpointUrlProblem(settings.endpoint.url);
  if (bad) return t('endpointBadUrl', { why: bad });
  return settings.endpoint.model === '' ? t('endpointNeedsModel') : undefined;
}

/** The host pattern to ask for, and the origin to name in messages. */
export function endpointAccess(url: string): { pattern: string; origin: string } {
  const parsed = new URL(url);
  return {
    pattern: `${parsed.protocol}//${parsed.hostname}/*`,
    origin: `${parsed.protocol}//${parsed.host}`,
  };
}
