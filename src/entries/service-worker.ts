// SPDX-License-Identifier: Apache-2.0
// Service worker: opens the side panel from the toolbar button and routes messages.
// The toolbar click is handled here, not by Chrome's openPanelOnActionClick: Chrome grants
// activeTab for an action click only when the click does not toggle the side panel by
// itself (ExtensionActionRunner::RunAction, Chromium), so the handler opens the panel and adds
// the page scripts under the grant (src/adapters/action-click.ts).
// It keeps no state it cannot rebuild (it stops after 30 seconds idle). It answers the
// WebGPU probe (here or in the offscreen document, which it opens), routes tool requests
// of the panel to the page scripts (shared/tool-routing.ts), and is the fallback model
// host when the offscreen document has no WebGPU.
import { httpOrigin } from '../adapters/allowed-sites';
import { onActionClick, type ActionDeps } from '../adapters/action-click';
import { removeLegacyCaches } from '../adapters/legacy-cache';
import { probeWebGpu } from '../adapters/webgpu-probe';
import type { GpuProbeRequest, GpuProbeResult } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';
import { allowedSites } from './shared/allowed-sites';
import { startBadge } from './shared/badge-wiring';
import { hostModels } from './shared/model-hosting';
import { fromExtensionPage } from './shared/sender';
import { injectBridge, startToolRouting } from './shared/tool-routing';

const OFFSCREEN_URL = 'offscreen.html';

// Runs at install and at every start of the worker. Chrome keeps the value, so this also
// turns off the `true` that builds before 13 Nov 2026 stored.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error: unknown) => {
  console.warn('WebAIAssist: could not set the side panel behaviour', error);
});

const ACTION_DEPS: ActionDeps = {
  openPanel: (windowId) => chrome.sidePanel.open({ windowId }),
  inject: injectBridge,
  allow: async (url) => {
    const origin = httpOrigin(url);
    if (origin !== undefined) await allowedSites.add(origin);
  },
  notifyPanel: () => chrome.runtime.sendMessage({ type: 'tools/changed' }),
  warn: (text, error) => console.warn(text, error),
};

// Registered at the top level so the click wakes the worker. `chrome.action` is missing only
// where the manifest has no action (stubbed test set-ups).
(chrome.action as typeof chrome.action | undefined)?.onClicked.addListener((tab) => {
  void onActionClick(ACTION_DEPS, tab);
});

// The Options (API key, endpoint address, gate mode) live in storage.local, which content
// scripts can read and write by default. Only the extension's own pages need it.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch((error: unknown) => {
  console.warn('WebAIAssist: could not restrict storage.local to extension pages', error);
});

async function ensureOffscreen(): Promise<void> {
  const open = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (open.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Hosts the local model runtime, which runs in a WebGPU worker.',
    // True since 0.1.0: the model's engine starts a dedicated Worker in the document
    // (shared/wllama-engine.ts).
  });
}

function failed(request: GpuProbeRequest, error: string): GpuProbeResult {
  const report = { available: false, adapter: false, features: [], limits: {}, error };
  return { type: 'probe/gpu-result', id: request.id, target: request.target, report };
}

async function probeOffscreen(request: GpuProbeRequest): Promise<GpuProbeResult> {
  await ensureOffscreen();
  const reply: unknown = await chrome.runtime.sendMessage(request);
  const parsed = parseMessage(reply, 'offscreen');
  if (parsed.ok && parsed.value.type === 'probe/gpu-result') return parsed.value;
  return failed(request, parsed.ok ? 'unexpected reply' : parsed.error);
}

async function answerProbe(request: GpuProbeRequest): Promise<GpuProbeResult> {
  try {
    if (request.target === 'offscreen') return await probeOffscreen(request);
    const report = await probeWebGpu(navigator.gpu);
    return { type: 'probe/gpu-result', id: request.id, target: 'worker', report };
  } catch (error) {
    return failed(request, error instanceof Error ? error.message : String(error));
  }
}

// After an update from 0.1.0: the model files of the engine that version used are of no use to
// this one and are removed (src/adapters/legacy-cache.ts). Nothing else runs at install.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') void removeLegacyCaches(caches);
});

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (!fromExtensionPage(sender)) return false;
  const parsed = parseMessage(raw, 'panel');
  if (!parsed.ok || parsed.value.type !== 'probe/gpu') return false;
  void answerProbe(parsed.value).then(sendResponse);
  return true;
});

startToolRouting();
startBadge();
hostModels('worker');
