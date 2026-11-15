// SPDX-License-Identifier: Apache-2.0
// Service-worker wiring for the page bridge: takes tools/list and tools/call from the
// extension's own pages (never from a content script), adds the two page scripts to the tab's top
// frame when nobody answers yet, and forwards the request: src/adapters/tool-router.ts.
// The toolbar click (service-worker.ts) adds the scripts through the same injector.
import { bridgeInjector } from '../../adapters/tab-injection';
import { routeToolRequest, type TabDeps } from '../../adapters/tool-router';
import { parseMessage } from '../../protocol/validate';
import { fromExtensionPage } from './sender';

const TOP_FRAME = [0];

/** Adds the two page scripts to a tab's top frame, one injection per tab at a time. */
export const injectBridge = bridgeInjector(async (tabId, file, world) => {
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: TOP_FRAME },
    files: [file],
    world,
  });
});

const TAB_DEPS: TabDeps = {
  sendToTab: (tabId, message) => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }),
  inject: injectBridge,
};

export function startToolRouting(): void {
  chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
    if (!fromExtensionPage(sender)) return false;
    const parsed = parseMessage(raw, 'panel');
    if (!parsed.ok) return false;
    const request = parsed.value;
    if (
      request.type !== 'tools/list' &&
      request.type !== 'tools/call' &&
      request.type !== 'tools/cancel'
    ) {
      return false;
    }
    void routeToolRequest(request, TAB_DEPS).then(sendResponse);
    return true;
  });
}
