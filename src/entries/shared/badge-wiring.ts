// SPDX-License-Identifier: Apache-2.0
// Service-worker wiring of the toolbar number (src/adapters/tool-badge.ts): refresh it when a tab
// finishes loading, when the user switches tab, when the page's top frame says its tools changed,
// when the list of allowed sites changes, and clear it when a site's access is taken away. It uses `chrome.action`, `chrome.permissions.contains`
// and the tool listing the worker already has; it needs no permission of its own.
import { MessagingToolBridge } from '../../adapters/messaging-tool-bridge';
import { sitePattern } from '../../adapters/compat-mode';
import { refreshBadge, type BadgeDeps } from '../../adapters/tool-badge';
import { routeToolRequest } from '../../adapters/tool-router';
import { ALLOWED_SITES_KEY } from '../../adapters/allowed-sites';
import { siteIsAllowed } from './allowed-sites';
import { parseMessage } from '../../protocol/validate';
import { TAB_DEPS } from './tool-routing';

const lister = new MessagingToolBridge(
  (message) => routeToolRequest(message as Parameters<typeof routeToolRequest>[0], TAB_DEPS),
  () => crypto.randomUUID(),
);

const DEPS: BadgeDeps = {
  // Both: Chrome holds the host permission, and the user allowed the site (an endpoint's host is not one).
  allowed: async (origin) =>
    (await chrome.permissions.contains({ origins: [sitePattern(origin)] })) &&
    (await siteIsAllowed(origin)),
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
  // The user allowed a site (or forgot one): the open tabs are read again at once, so the number
  // does not wait for the next page load.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ALLOWED_SITES_KEY in changes) clearAll();
  });
}
