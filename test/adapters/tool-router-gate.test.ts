// SPDX-License-Identifier: Apache-2.0
// After "Forget this site" (or for a host that is only the chat endpoint) the panel gets no tools
// and no call reaches the page, even though the page scripts are still in the open tab.
import { describe, expect, it } from 'vitest';
import { NOT_ALLOWED_TEXT } from '../../src/adapters/page-access';
import { routeToolRequest, type TabDeps } from '../../src/adapters/tool-router';

const ORIGIN = 'http://localhost:11434';
const list = { type: 'tools/list', id: 'l1', tabId: 1 } as const;

function tab(allowedOrigins: string[], gateOrigin: string | null = ORIGIN) {
  const sent: object[] = [];
  const deps: TabDeps = {
    sendToTab: (_id, message) => {
      sent.push(message);
      return Promise.resolve({
        type: 'tools/list-result',
        id: 'l1',
        ok: true,
        tools: [],
        origin: ORIGIN,
      });
    },
    inject: () => Promise.resolve(),
    gate: {
      originOf: () => Promise.resolve(gateOrigin ?? undefined),
      allowed: (o) => Promise.resolve(allowedOrigins.includes(o)),
    },
  };
  return { deps, sent };
}

describe('routeToolRequest with the allowed-sites gate', () => {
  it('lists the tools of an allowed site', async () => {
    const t = tab([ORIGIN]);
    expect(await routeToolRequest(list, t.deps)).toMatchObject({ ok: true });
  });

  it('refuses a list for a site that is not allowed, without asking the page', async () => {
    const t = tab([]);
    const reply = await routeToolRequest(list, t.deps);
    expect(reply).toMatchObject({ ok: false, error: NOT_ALLOWED_TEXT, access: 'denied' });
    expect(t.sent).toEqual([]);
  });

  it('refuses a call for a site that is not allowed, without asking the page', async () => {
    const t = tab([]);
    const call = { type: 'tools/call', id: 'c1', tabId: 1, origin: ORIGIN, name: 'x', args: {} };
    const reply = await routeToolRequest(call as Parameters<typeof routeToolRequest>[0], t.deps);
    expect(reply).toMatchObject({ ok: false, text: NOT_ALLOWED_TEXT });
    expect(t.sent).toEqual([]);
  });

  it('never asks the scripts left in a tab the extension cannot read (a forgotten site)', async () => {
    const t = tab([ORIGIN], null);
    const reply = await routeToolRequest(list, t.deps);
    expect(reply).toMatchObject({ ok: false, access: 'denied' });
    expect(t.sent).toEqual([]);
    const call = { type: 'tools/call', id: 'c1', tabId: 1, origin: ORIGIN, name: 'x', args: {} };
    const called = await routeToolRequest(call as Parameters<typeof routeToolRequest>[0], t.deps);
    expect(called).toMatchObject({ ok: false });
    expect(t.sent).toEqual([]);
  });

  it('for a tab it cannot read, tries only the injection and reports why that fails', async () => {
    const t = tab([], null);
    const deps: TabDeps = {
      ...t.deps,
      inject: () => Promise.reject(new Error('Cannot access contents of the page.')),
    };
    const reply = await routeToolRequest(list, deps);
    expect(reply).toMatchObject({ ok: false });
    expect(t.sent).toEqual([]);
  });

  it('refuses when the gate itself fails', async () => {
    const failing: TabDeps = {
      ...tab([]).deps,
      gate: {
        originOf: () => Promise.reject(new Error('gone')),
        allowed: () => Promise.resolve(true),
      },
    };
    expect(await routeToolRequest(list, failing)).toMatchObject({ ok: false, access: 'denied' });
  });
});
