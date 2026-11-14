// SPDX-License-Identifier: Apache-2.0
// The real dependencies the side panel uses to follow the browser and to read the open site:
// chrome.scripting for the reads (src/adapters/site-files.ts), chrome.tabs for the title and
// address, and the browser events that mean "the page in front changed". No new permission:
// the reads use the same grant as the page tools (activeTab or the site's host permission),
// and the tab's title and address come back only for a site the extension may read.
import {
  readPageData,
  readSiteFiles,
  type SiteScripting,
  type Timer,
} from '../../adapters/site-files';
import type { BrowserEvent, SiteDeps } from '../../ui/site-deps';

const scripting: SiteScripting = {
  executeScript: (injection) => chrome.scripting.executeScript(injection as never),
};

function realTimer(ms: number): Timer {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const done = new Promise<void>((resolve) => {
    handle = setTimeout(resolve, ms);
  });
  return { done, cancel: () => clearTimeout(handle) };
}

function status(value: string | undefined): 'loading' | 'complete' | undefined {
  return value === 'loading' || value === 'complete' ? value : undefined;
}

/** Chrome's events about the tab in front, as the panel's own event type. */
function subscribe(listener: (event: BrowserEvent) => void): () => void {
  const activated = (): void => listener({ kind: 'tab-activated' });
  const updated = (tabId: number, info: chrome.tabs.OnUpdatedInfo): void => {
    const state = status(info.status);
    listener({
      kind: 'tab-updated',
      tabId,
      ...(state === undefined ? {} : { status: state }),
      ...(info.url === undefined ? {} : { url: info.url }),
      ...(info.title === undefined ? {} : { title: info.title }),
    });
  };
  const focused = (windowId: number): void => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) listener({ kind: 'window-focus' });
  };
  const granted = (): void => listener({ kind: 'access-changed' });
  chrome.tabs.onActivated.addListener(activated);
  chrome.tabs.onUpdated.addListener(updated);
  chrome.windows.onFocusChanged.addListener(focused);
  chrome.permissions.onAdded.addListener(granted);
  chrome.permissions.onRemoved.addListener(granted);
  return () => {
    chrome.tabs.onActivated.removeListener(activated);
    chrome.tabs.onUpdated.removeListener(updated);
    chrome.windows.onFocusChanged.removeListener(focused);
    chrome.permissions.onAdded.removeListener(granted);
    chrome.permissions.onRemoved.removeListener(granted);
  };
}

export const siteDeps: SiteDeps = {
  files: (target) => readSiteFiles({ scripting, timer: realTimer }, target),
  page: (target) => readPageData({ scripting }, target),
  tab: async (tabId) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      return {
        ...(tab.title === undefined ? {} : { title: tab.title }),
        ...(tab.url === undefined ? {} : { url: tab.url }),
      };
    } catch {
      return {};
    }
  },
  events: subscribe,
};
