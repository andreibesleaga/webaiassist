// SPDX-License-Identifier: Apache-2.0
// Isolated-world content script, added to a tab by the service worker on the first tool
// request (src/entries/shared/tool-routing.ts). It relays tools/list and tools/call to the
// MAIN-world script and checks every reply: src/adapters/page-bridge-isolated.ts.
import { startIsolatedRelay } from '../adapters/page-bridge-isolated';

const FLAG = '__webaiassistIsolatedRelay';
const scope = globalThis as unknown as Record<string, unknown>;

if (scope[FLAG] !== true) {
  scope[FLAG] = true;
  startIsolatedRelay({
    win: window,
    runtime: chrome.runtime,
    channel: crypto.randomUUID(),
    newId: () => crypto.randomUUID(),
    location: window.location,
    hasLinkset: () =>
      document.querySelector('link[href$="/.well-known/knowledge-linkset"]') !== null,
  });
}
