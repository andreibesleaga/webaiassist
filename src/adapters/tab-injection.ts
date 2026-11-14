// SPDX-License-Identifier: Apache-2.0
// Adds the two page-bridge scripts to a tab's top frame. The MAIN-world script goes first:
// once the isolated relay answers a request, the script it relays to is already listening.
// The toolbar click and the panel's first request can both start an injection; one runs per
// tab at a time and every caller waits for it.

export type World = 'MAIN' | 'ISOLATED';

/** chrome.scripting.executeScript for one file in one world of the tab's top frame. */
export type RunScript = (tabId: number, file: string, world: World) => Promise<void>;

export const BRIDGE_SCRIPTS: readonly (readonly [string, World])[] = [
  ['content-main.js', 'MAIN'],
  ['content-isolated.js', 'ISOLATED'],
];

export function bridgeInjector(run: RunScript): (tabId: number) => Promise<void> {
  const running = new Map<number, Promise<void>>();
  const injectOnce = async (tabId: number): Promise<void> => {
    for (const [file, world] of BRIDGE_SCRIPTS) await run(tabId, file, world);
  };
  return (tabId) => {
    const current = running.get(tabId);
    if (current) return current;
    const started = injectOnce(tabId).finally(() => running.delete(tabId));
    running.set(tabId, started);
    return started;
  };
}
