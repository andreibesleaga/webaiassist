// SPDX-License-Identifier: Apache-2.0
// The browser parts the explorer page reads a node's files with: chrome.scripting for the reads
// (the same isolated-world script as the side panel's site reads) and a timer the reader can stop.
import type { SiteReadDeps, SiteScripting, Timer } from '../../adapters/site-files';

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

export const explorerDeps: SiteReadDeps = { scripting, timer: realTimer };
