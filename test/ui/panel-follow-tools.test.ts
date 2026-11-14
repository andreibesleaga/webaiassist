// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startPanel } from '../../src/ui/panel-controller';
import { QUIET_MS } from '../../src/ui/panel-follow';
import { loadPage } from './dom';
import { fakeDeps } from './panel-fakes';

/** Lets pending promises run; the timers stay fake. */
async function flush(): Promise<void> {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
}

describe('the panel follows the page', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('reads the page again, once, a moment after the page says its tools changed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      const deps = fakeDeps([]);
      await startPanel(deps);
      const before = deps.bridge.pageCalls;
      deps.bridge.replaceTools(7, []);
      deps.bridge.replaceTools(7, []);
      await flush();
      expect(deps.bridge.pageCalls).toBe(before);
      await vi.advanceTimersByTimeAsync(QUIET_MS);
      await flush();
      expect(deps.bridge.pageCalls).toBe(before + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
