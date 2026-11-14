// SPDX-License-Identifier: Apache-2.0
// The address of the explorer page. The extension builds it (the side panel's Graph button) and the
// page reads it back: the tab to read through and the origin that tab was on. Both are checked
// again where they are used (the page script refuses a tab that is on another origin), so the
// address can name nothing the extension would not read anyway. No browser API here.

export interface ExplorerTarget {
  readonly tabId: number;
  readonly origin: string;
}

const ORIGIN = /^https?:\/\/[^/?#]+$/;

/** The query string of the explorer page for `target`: also `src`, the node the site's code opens. */
export function explorerQuery(target: ExplorerTarget): string {
  const query = new URLSearchParams({
    tabid: String(target.tabId),
    origin: target.origin,
    src: `${target.origin}/`,
  });
  return query.toString();
}

/** The tab and origin named by an explorer page address, or undefined when either is missing or odd. */
export function parseExplorerQuery(search: string): ExplorerTarget | undefined {
  const query = new URLSearchParams(search);
  const tabId = query.get('tabid') ?? '';
  const origin = query.get('origin') ?? '';
  if (!/^\d{1,10}$/.test(tabId) || !ORIGIN.test(origin)) return undefined;
  return { tabId: Number(tabId), origin };
}
