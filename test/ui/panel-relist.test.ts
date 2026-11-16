// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// A page that registers its tools a moment after the panel first looks (a slow page, the first
// start of a browser) is listed again after one and after three seconds, so the card does not
// stay at "no tools" until the page happens to change something.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolInfo } from '../../src/core/types';
import { byId, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN } from './panel-fakes';
import { fakeClock, flush, open } from './site-helpers';

const late: ToolInfo = {
  name: 'late_tool',
  description: 'Registered after the first look.',
  annotations: { readOnlyHint: true },
};

function lateBridge(): FakePanelBridge {
  const bridge = new FakePanelBridge([]);
  bridge.pageResult = { origin: ORIGIN, linkset: false, tools: [] };
  return bridge;
}

async function after(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}

describe('listing again when the first list is empty', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('shows tools registered after the first look, within three seconds', async () => {
    const bridge = lateBridge();
    const deps = fakeDeps([], { bridge });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    expect(byId('page-status').textContent).not.toContain('1 WebMCP tool');
    bridge.pageResult = { origin: ORIGIN, linkset: false, tools: [late] };
    await after(3_100);
    expect(byId('page-status').textContent).toContain('1 WebMCP tool');
  });

  it('asks the page at most three times when it has no tools at all', async () => {
    const bridge = lateBridge();
    const deps = fakeDeps([], { bridge });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    const first = bridge.pageCalls;
    await after(10_000);
    expect(bridge.pageCalls - first).toBe(2);
  });

  it('does not list again when the first list had tools', async () => {
    const bridge = new FakePanelBridge([late]);
    const deps = fakeDeps([], { bridge });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    const first = bridge.pageCalls;
    await after(10_000);
    expect(bridge.pageCalls).toBe(first);
  });
});
