// SPDX-License-Identifier: Apache-2.0
// A call whose page closed the connection before it answered (the page navigated) is never sent
// again to the page that follows: the call would run twice. The user reads one plain sentence.
import { describe, expect, it } from 'vitest';
import { routeToolRequest, type TabDeps } from '../../src/adapters/tool-router';

const call = {
  type: 'tools/call',
  id: 'c1',
  tabId: 4,
  origin: 'https://a.example',
  name: 't',
  args: {},
} as const;

function deps(error: string) {
  const sent: object[] = [];
  let injected = 0;
  const tab: TabDeps = {
    sendToTab: (_id, message) => {
      sent.push(message);
      return Promise.reject(new Error(error));
    },
    inject: () => {
      injected += 1;
      return Promise.resolve();
    },
  };
  return { tab, sent, injected: () => injected };
}

describe('a call when the page closes the connection', () => {
  it('says the page navigated, sends once and injects nothing', async () => {
    const d = deps('The message port closed before a response was received.');
    const result = await routeToolRequest(call, d.tab);
    expect(result).toMatchObject({ type: 'tools/call-result', id: 'c1', ok: false });
    expect(JSON.stringify(result)).toContain('the page navigated');
    expect(d.sent).toHaveLength(1);
    expect(d.injected()).toBe(0);
  });

  it('still adds the page scripts when nobody listened at all', async () => {
    const d = deps('Could not establish connection. Receiving end does not exist.');
    const result = await routeToolRequest(call, d.tab);
    expect(d.injected()).toBe(1);
    expect(d.sent).toHaveLength(2);
    expect(result).toMatchObject({ ok: false });
  });
});
