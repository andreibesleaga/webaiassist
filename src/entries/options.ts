// SPDX-License-Identifier: Apache-2.0
// Options page entry: settings in chrome.storage.local, memory in IndexedDB, host access
// for an endpoint asked through chrome.permissions (src/ui/options-page.ts).
import { openIndexedDbMemory } from '../adapters/indexeddb-memory';
import { probeWebGpu } from '../adapters/webgpu-probe';
import { loadSettings, resetSettings, saveSettings } from '../adapters/settings';
import { applyI18n, setLanguage } from '../ui/i18n';
import { forgetAll } from './shared/forget-all';
import { createModelStore } from './shared/model-store';
import { startOptions } from '../ui/options-page';

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
    reset: () => resetSettings(local),
    requestOrigin: (pattern) => chrome.permissions.request({ origins: [pattern] }),
    clearMemory: async () => (await openIndexedDbMemory()).clear(),
    store: createModelStore(),
    forgetAll,
  });
}

void main();
