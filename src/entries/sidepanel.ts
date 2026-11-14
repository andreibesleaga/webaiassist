// SPDX-License-Identifier: Apache-2.0
// Side panel entry: builds the real dependencies (chrome.*, IndexedDB, the page bridge)
// and starts the panel (src/ui/panel-controller.ts). The panel reads the open page when it
// starts, on a tab switch or navigation, on a tools/changed notice, and after a site grant. In the development build only
// (dist-smoke/, used by the smoke test), opened as a tab it accepts ?tab=<id> to choose the
// page it works on; the release build folds this away and works on the active tab.
import { CfWorkerArgsValidator } from '../adapters/cfworker-args-validator';
import { enableCompat } from '../adapters/compat-mode';
import { cpuRuntimeSupport } from '../adapters/cpu-support';
import { forgetSite } from '../adapters/forget-site';
import { gpuKey } from '../adapters/gpu-speed';
import { openIndexedDbMemory } from '../adapters/indexeddb-memory';
import { MessagingToolBridge } from '../adapters/messaging-tool-bridge';
import { NoMemory } from '../adapters/no-memory';
import { readPageText } from '../adapters/page-reader';
import { builtInState, hasPromptApi, type AvailabilityLike } from '../adapters/prompt-api-state';
import { SessionSiteGrants } from '../adapters/session-site-grants';
import { allowSite } from '../adapters/site-access';
import { loadSettings, saveSettings, SETTINGS_KEY } from '../adapters/settings';
import { loadPanelState, savePanelState } from '../adapters/stored-panel-state';
import type { Memory } from '../core/ports/memory';
import { parseMessage } from '../protocol/validate';
import { applyI18n, setLanguage } from '../ui/i18n';
import { startPanel, type PanelDeps } from '../ui/panel-controller';
import { cpuTestModels } from './shared/cpu-engine';
import { createModelStore } from './shared/model-store';
import { createRuntime } from './shared/panel-runtimes';
import { siteDeps } from './shared/site-deps';
import { fromExtensionPage } from './shared/sender';

const fixedTab = __WEBAIASSIST_SMOKE__
  ? Number(new URLSearchParams(location.search).get('tab'))
  : 0;
/** Development build only: `?follow=1` makes the fixed tab the first one and then follows the
 *  tab the test brings to the front (the panel is itself a tab there, so "active tab" would be it). */
const followBrowser = __WEBAIASSIST_SMOKE__ && new URLSearchParams(location.search).has('follow');
let followed = fixedTab;

async function followActive(): Promise<void> {
  const own = (await chrome.tabs.getCurrent())?.id;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id !== undefined && tab.id !== own) followed = tab.id;
}

async function targetTab(): Promise<number | undefined> {
  if (followBrowser) return followed > 0 ? followed : undefined;
  if (Number.isInteger(fixedTab) && fixedTab > 0) return fixedTab;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

interface GpuProbe {
  readonly works: boolean;
  readonly key?: string;
  /** The adapter reports the `shader-f16` feature (Gemma 4 E2B needs it). */
  readonly shaderF16: boolean;
}

/** The panel's WebGPU probe: whether an adapter is found, its name and whether it has
 *  `shader-f16`. It is one input of the default model, the key of the stored first-answer
 *  measurement, and decides whether the model that needs `shader-f16` is listed. */
async function probeGpu(): Promise<GpuProbe> {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return { works: false, shaderF16: false };
    return {
      works: true,
      key: gpuKey(adapter.info) ?? 'unnamed',
      shaderF16: adapter.features.has('shader-f16'),
    };
  } catch {
    return { works: false, shaderF16: false };
  }
}

const siteAccessDeps = {
  request: (origins: string[]) => chrome.permissions.request({ origins }),
  // Chrome 133+; the manifest allows Chrome 124, where the panel points to the toolbar button.
  ...(typeof chrome.permissions.addHostAccessRequest === 'function'
    ? { addHostAccessRequest: (r: { tabId: number }) => chrome.permissions.addHostAccessRequest(r) }
    : {}),
};

let indexedDb: Promise<Memory> | undefined;

function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const compatDeps = {
  request: (origins: string[]) => chrome.permissions.request({ origins }),
  register: (script: chrome.scripting.RegisteredContentScript) =>
    chrome.scripting.registerContentScripts([script]),
  isRegistered: async (id: string) =>
    (await chrome.scripting.getRegisteredContentScripts({ ids: [id] })).length > 0,
  reload: (tabId: number) => chrome.tabs.reload(tabId),
};

const forgetDeps = {
  // Memory is cleared even when it is off now: it may hold chats from before.
  memory: {
    clear: async (origin?: string) => (await (indexedDb ??= openIndexedDbMemory())).clear(origin),
  },
  grants: new SessionSiteGrants(chrome.storage.session),
  compat: {
    unregister: (ids: string[]) => chrome.scripting.unregisterContentScripts({ ids }),
    removeOrigins: (origins: string[]) => chrome.permissions.remove({ origins }),
  },
};

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** What this computer offers the model list. */
function computerEnv(gpu: GpuProbe): PanelDeps['env'] {
  return {
    promptApi: hasPromptApi((globalThis as { LanguageModel?: unknown }).LanguageModel),
    scripted: __WEBAIASSIST_SMOKE__,
    webgpu: gpu.works,
    shaderF16: gpu.shaderF16,
    ...(gpu.key === undefined ? {} : { gpuKey: gpu.key }),
    cpu: __WEBAIASSIST_FAKE_CPU__ || cpuRuntimeSupport(WebAssembly).supported,
    extraCpuModels: cpuTestModels,
  };
}

async function buildDeps(bridge: MessagingToolBridge): Promise<PanelDeps> {
  const local = chrome.storage.local;
  return {
    doc: document,
    env: computerEnv(await probeGpu()),
    bridge,
    grants: new SessionSiteGrants(chrome.storage.session),
    clock: { nowIso: () => new Date().toISOString() },
    validator: new CfWorkerArgsValidator(),
    loadSettings: () => loadSettings(local),
    saveSettings: (settings) => saveSettings(local, settings),
    memory: (settings) =>
      settings.memory ? (indexedDb ??= openIndexedDbMemory()) : Promise.resolve(new NoMemory()),
    targetTab,
    site: siteDeps,
    readPage: (tabId) => readPageText(chrome.scripting, tabId),
    allowSite: (page) => allowSite(siteAccessDeps, page),
    enableCompat: (page) => enableCompat(compatDeps, page),
    forgetSite: (origin) => forgetSite(forgetDeps, origin),
    createRuntime,
    store: createModelStore(),
    loadState: () => loadPanelState(local),
    saveState: (patch) => savePanelState(local, patch),
    nowMs: () => performance.now(),
    isOnline: () => navigator.onLine,
    copyText,
    persistStorage: () => navigator.storage?.persist?.() ?? Promise.resolve(false),
    version: chrome.runtime.getManifest().version,
    download,
    openOptions: () => void chrome.runtime.openOptionsPage(),
    builtInState: () =>
      builtInState((globalThis as { LanguageModel?: AvailabilityLike }).LanguageModel),
  };
}

async function main(): Promise<void> {
  setLanguage((await loadSettings(chrome.storage.local)).language);
  applyI18n(document);
  const bridge = new MessagingToolBridge(
    (message) => chrome.runtime.sendMessage(message),
    () => crypto.randomUUID(),
  );
  const panel = await startPanel(await buildDeps(bridge));
  chrome.runtime.onMessage.addListener((raw: unknown, sender) => {
    bridge.notify(raw, sender);
    // The service worker added the page scripts after a toolbar click: read the page again.
    if (sender.tab === undefined && fromExtensionPage(sender)) {
      const parsed = parseMessage(raw, 'panel');
      if (parsed.ok && parsed.value.type === 'tools/changed') void panel.refresh();
    }
    return false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SETTINGS_KEY in changes) void panel.reloadSettings();
  });
  if (followBrowser) {
    chrome.tabs.onActivated.addListener(() => void followActive());
    chrome.windows.onFocusChanged.addListener(() => void followActive());
  }
}

void main();
