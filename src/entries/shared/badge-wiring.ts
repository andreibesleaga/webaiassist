// SPDX-License-Identifier: Apache-2.0
// Service-worker wiring of the toolbar number (src/adapters/tool-badge.ts): refresh it when a tab
// finishes loading, when the user switches tab, when the page's top frame says its tools changed,
// and clear it when a site's access is taken away. It uses `chrome.action`, `chrome.permissions.contains`
// and the tool listing the worker already has; it needs no permission of its own.
import { MessagingToolBridge } from '../../adapters/messaging-tool-bridge';
import { sitePattern } from '../../adapters/compat-mode';
import { refreshBadge, type BadgeDeps } from '../../adapters/tool-badge';
import { routeToolRequest } from '../../adapters/tool-router';
import { parseMessage } from '../../protocol/validate';
import { injectBridge } from './tool-routing';

const TAB_DEPS = {
  sendToTab: (tabId: number, message: object) =>
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }),
  inject: injectBridge,
};

const lister = new MessagingToolBridge(
  (message) => routeToolRequest(message as Parameters<typeof routeToolRequest>[0], TAB_DEPS),
  () => crypto.randomUUID(),
);

const DEPS: BadgeDeps = {
  allowed: (origin) => chrome.permissions.contains({ origins: [sitePattern(origin)] }),
  list: (tabId) => lister.list(tabId),
  set: (tabId, text) => chrome.action.setBadgeText({ tabId, text }),
};

const refreshTab = (tab: chrome.tabs.Tab): void => {
  if (tab.id !== undefined)
    void refreshBadge(DEPS, { id: tab.id, ...(tab.url ? { url: tab.url } : {}) });
};

function refreshById(tabId: number): void {
  chrome.tabs.get(tabId).then(refreshTab, () => undefined);
}

/** Reads every tab again (a site's access was taken away, or the browser or extension started). */
function clearAll(): void {
  chrome.tabs.query({}).then(
    (tabs) => tabs.forEach(refreshTab),
    () => undefined,
  );
}

/** A "tools changed" notice from the top frame of a tab (never from an extension page). */
function onToolsChanged(raw: unknown, sender: chrome.runtime.MessageSender): boolean {
  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId !== 0) return false;
  const parsed = parseMessage(raw, 'content');
  if (parsed.ok && parsed.value.type === 'tools/changed') refreshById(tabId);
  return false;
}

/** A page registers its tools while it loads: the count is read again a little later, twice. */
const AFTER_LOAD_MS = [600, 2500];

function refreshAfterLoad(tabId: number): void {
  refreshById(tabId);
  for (const wait of AFTER_LOAD_MS) setTimeout(() => refreshById(tabId), wait);
}

export function startBadge(): void {
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'complete') refreshAfterLoad(tabId);
  });
  chrome.tabs.onActivated.addListener((active) => refreshById(active.tabId));
  chrome.runtime.onMessage.addListener(onToolsChanged);
  chrome.permissions.onRemoved.addListener(clearAll);
  // Tabs that were open before the extension started or was updated.
  chrome.runtime.onInstalled.addListener(clearAll);
  chrome.runtime.onStartup.addListener(clearAll);
}
