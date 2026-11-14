// SPDX-License-Identifier: Apache-2.0
// The Options page: model runtime, step cap, confirmation mode, memory, language, Reset.
// Saving an endpoint asks the browser for access to that one site, from the Save click.
import type { StoreLike } from '../adapters/model-store';
import type { Settings } from '../adapters/settings';
import { byId } from './dom';
import { t } from './i18n';
import {
  buildLists,
  endpointAccess,
  endpointProblem,
  fillForm,
  readForm,
  syncVisibility,
} from './options-form';
import { bindStorage } from './options-storage';

export interface OptionsDeps {
  readonly doc: Document;
  /** The graphics card reports `shader-f16`; leave unset when not known. */
  readonly shaderF16?: boolean;
  load(): Promise<Settings>;
  save(settings: Settings): Promise<Settings>;
  reset(): Promise<void>;
  /** chrome.permissions.request for one host pattern; must start inside the click. */
  requestOrigin(pattern: string): Promise<boolean>;
  clearMemory(): Promise<void>;
  /** The model files stored in this browser. */
  readonly store: StoreLike;
  /** "Forget all sites": chats, tool permissions, compat scripts and site access. */
  forgetAll(): Promise<void>;
}

function status(deps: OptionsDeps, text: string): void {
  byId(deps.doc, 'options-status').textContent = text;
}

/** Synchronous up to requestOrigin, so the permission prompt keeps the user gesture. */
function onSave(deps: OptionsDeps): void {
  const settings = readForm(deps.doc);
  const problem = endpointProblem(settings);
  if (problem) return status(deps, problem);
  const access =
    settings.runtime === 'endpoint' ? endpointAccess(settings.endpoint.url) : undefined;
  const granted = access ? deps.requestOrigin(access.pattern) : Promise.resolve(true);
  void Promise.all([granted, deps.save(settings)])
    .then(([ok, saved]) => {
      fillForm(deps.doc, saved);
      syncVisibility(deps.doc);
      status(deps, ok ? t('saved') : t('endpointNeedsAccess', { origin: access?.origin ?? '' }));
    })
    .catch((error: unknown) => status(deps, String(error)));
}

async function onReset(deps: OptionsDeps): Promise<void> {
  await deps.reset();
  fillForm(deps.doc, await deps.load());
  syncVisibility(deps.doc);
  status(deps, t('resetDone'));
}

export async function startOptions(deps: OptionsDeps): Promise<void> {
  const doc = deps.doc;
  buildLists(doc, deps.shaderF16);
  fillForm(doc, await deps.load());
  syncVisibility(doc);
  doc.querySelectorAll('input[name="runtime"]').forEach((radio) => {
    radio.addEventListener('change', () => syncVisibility(doc));
  });
  byId(doc, 'options').addEventListener('submit', (event) => {
    event.preventDefault();
    onSave(deps);
  });
  byId(doc, 'reset').addEventListener('click', () => void onReset(deps));
  byId(doc, 'clear-memory').addEventListener('click', () => {
    void deps.clearMemory().then(() => status(deps, t('memoryCleared')));
  });
  const preset = byId<HTMLSelectElement>(doc, 'endpoint-preset');
  preset.addEventListener('change', () => {
    if (preset.value !== '') byId<HTMLInputElement>(doc, 'endpoint-url').value = preset.value;
  });
  // Last: the form works whether or not the model list answers.
  await bindStorage({ doc, store: deps.store, forgetAll: () => deps.forgetAll() });
}
