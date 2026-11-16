// SPDX-License-Identifier: Apache-2.0
// The toolbar button. Chrome grants activeTab for a click only when the click is not set to
// open the side panel by itself (openPanelOnActionClick: false, set by the service worker), so
// the click handler opens the panel, adds the page scripts under that grant, and tells an open
// panel to read the page again. sidePanel.open() must be called inside the click, before any
// await, or Chrome refuses it as not coming from a user gesture.

export interface ActionTab {
  readonly id?: number;
  readonly windowId: number;
  /** Readable under the activeTab grant of this click. */
  readonly url?: string;
}

export interface ActionDeps {
  openPanel(windowId: number): Promise<void>;
  inject(tabId: number): Promise<void>;
  /** The click is the user allowing WebAIAssist on this page's site: it goes on the allowed list. */
  allow(url: string | undefined): Promise<void>;
  /** A tools/changed notice from the service worker; it fails when no panel is open. */
  notifyPanel(): Promise<unknown>;
  warn(text: string, error: unknown): void;
}

export function onActionClick(deps: ActionDeps, tab: ActionTab): Promise<void> {
  const opened = deps
    .openPanel(tab.windowId)
    .catch((error: unknown) => deps.warn('WebAIAssist: could not open the side panel', error));
  if (tab.id === undefined) return opened;
  // The scripts go in at once (the grant only lasts for this click); the site is listed alongside.
  const injected = Promise.all([deps.inject(tab.id), deps.allow(tab.url)]).then(
    // No panel open yet is fine: the panel reads the page when it starts.
    () => deps.notifyPanel().catch(() => undefined),
    (error: unknown) => deps.warn('WebAIAssist: could not add the page scripts', error),
  );
  return Promise.all([opened, injected]).then(() => undefined);
}
