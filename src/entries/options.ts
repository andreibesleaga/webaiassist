// SPDX-License-Identifier: Apache-2.0
// Options page entry: settings in chrome.storage.local, memory in IndexedDB, host access
// for an endpoint asked through chrome.permissions (src/ui/options-page.ts).
import { openIndexedDbMemory } from '../adapters/indexeddb-memory';
import { probeWebGpu } from '../adapters/webgpu-probe';
import { loadSettings, saveSettings } from '../adapters/settings';
import { loadPanelState } from '../adapters/stored-panel-state';
import { builtInState, type AvailabilityLike } from '../adapters/prompt-api-state';
import { browserOf } from '../ui/panel-diagnostics';
import { applyI18n, setLanguage, t } from '../ui/i18n';
import { forgetAll } from './shared/forget-all';
import { createModelStore } from './shared/model-store';
import { startOptions } from '../ui/options-page';
import { resetOptions } from '../ui/options-reset';

const lastError = (state: { lastError?: string }) =>
  state.lastError === undefined ? {} : { lastError: state.lastError };

async function main(): Promise<void> {
  const local = chrome.storage.local;
  const gpu = await probeWebGpu(navigator.gpu);
  setLanguage((await loadSettings(local)).language);
  applyI18n(document);
  await startOptions({
    doc: document,
    shaderF16: gpu.features.includes('shader-f16'),
    load: () => loadSettings(local),
    save: (settings) => saveSettings(local, settings),
    reset: () =>
      resetOptions({
        area: local,
        removeOrigins: (origins) => chrome.permissions.remove({ origins }),
      }),
    requestOrigin: (pattern) => chrome.permissions.request({ origins: [pattern] }),
    clearMemory: async () => (await openIndexedDbMemory()).clear(),
    store: createModelStore(),
    forgetAll,
    copyText: (text) => navigator.clipboard.writeText(text),
    diagnostics: async () => ({
      version: chrome.runtime.getManifest().version,
      browser: browserOf(navigator.userAgent),
      webmcp: t('diagWebmcpNotHere'),
      builtIn: await builtInState(
        (globalThis as { LanguageModel?: AvailabilityLike }).LanguageModel,
      ),
      ...((gpu.vendor ?? gpu.architecture) === undefined && !gpu.adapter
        ? {}
        : {
            gpu: {
              ...(gpu.vendor === undefined ? {} : { vendor: gpu.vendor }),
              ...(gpu.architecture === undefined ? {} : { architecture: gpu.architecture }),
              shaderF16: gpu.features.includes('shader-f16'),
            },
          }),
      ...lastError(await loadPanelState(local)),
    }),
  });
}

void main();
