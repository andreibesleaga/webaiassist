// SPDX-License-Identifier: Apache-2.0
// The wire for the parity package: tools/cancel in the service worker and the protocol, the
// debugging hint and the form of a tool.
import { describe, expect, it } from 'vitest';
import type { DocumentLike } from '../../src/adapters/form-tools';
import { startIsolatedRelay } from '../../src/adapters/page-bridge-isolated';
import { startMainBridge } from '../../src/adapters/page-bridge-main';
import { routeToolRequest, type TabDeps } from '../../src/adapters/tool-router';
import type { ModelContextLike } from '../../src/adapters/webmcp-reader';
import { parseMessage } from '../../src/protocol/validate';
import { FakeContentRuntime, FakeWindow } from './bridge-bus';

const ORIGIN = 'https://node.example';
const CHANNEL = 'aaaaaaaa-1111-4bbb-8ccc-222222222222';

const entry = (name: string, extra: object = {}) => ({
  name,
  description: `Tool ${name}.`,
  origin: ORIGIN,
  ...extra,
});

/** The relay and the MAIN bridge on one fake window, as in a tab. */
function tab(context: ModelContextLike, forms?: DocumentLike) {
  const win = new FakeWindow(ORIGIN) as FakeWindow & { document?: DocumentLike };
  if (forms) win.document = forms;
  const runtime = new FakeContentRuntime();
  let n = 0;
  startIsolatedRelay({
    win,
    runtime,
    channel: CHANNEL,
    newId: () => `p${(n += 1)}`,
    location: { origin: ORIGIN },
    hasLinkset: () => false,
  });
  startMainBridge(win, () => context);
  return { win, runtime };
}

const list = (runtime: FakeContentRuntime) =>
  runtime.deliver({ type: 'tools/list', id: 'l1', tabId: 1 }) as Promise<{
    tools: { name: string; annotations?: object; form?: object }[];
  }>;

describe('tools/cancel in the service worker and the protocol', () => {
  const deps = (ready: boolean): TabDeps & { sent: object[] } => {
    const sent: object[] = [];
    return {
      sent,
      sendToTab: (_id, message) => {
        sent.push(message);
        return ready
          ? Promise.resolve({ type: 'tools/call-result', id: 'k1', ok: true, text: '' })
          : Promise.reject(new Error('Receiving end does not exist.'));
      },
      inject: () => Promise.reject(new Error('must not inject for a cancel')),
    };
  };

  it('is sent to the tab without the tab id, and never adds the page scripts', async () => {
    const live = deps(true);
    const reply = await routeToolRequest({ type: 'tools/cancel', id: 'k1', tabId: 3 }, live);
    expect(live.sent).toEqual([{ type: 'tools/cancel', id: 'k1' }]);
    expect(reply).toMatchObject({ type: 'tools/call-result', ok: true });
    const dead = await routeToolRequest({ type: 'tools/cancel', id: 'k1', tabId: 3 }, deps(false));
    expect(dead).toMatchObject({ type: 'tools/call-result', id: 'k1', ok: true });
    expect(await routeToolRequest({ type: 'tools/cancel', id: 'k1' }, deps(true))).toMatchObject({
      ok: false,
    });
  });

  it('is a valid message on the panel, content and page hops only, with no extra fields', () => {
    for (const hop of ['panel', 'content', 'page'] as const) {
      expect(parseMessage({ type: 'tools/cancel', id: 'a' }, hop).ok).toBe(true);
    }
    expect(parseMessage({ type: 'tools/cancel', id: 'a' }, 'offscreen').ok).toBe(false);
    expect(parseMessage({ type: 'tools/cancel', id: 'a', extra: 1 }, 'panel').ok).toBe(false);
  });

  it('a tool with a form and the debugging hint passes the schema; a bad form kind does not', () => {
    const tool = {
      name: 'f',
      description: 'd',
      annotations: { debugging: true },
      form: { autosubmit: false, sensitive: ['password'] },
    };
    const result = { type: 'tools/list-result', id: 'x', ok: true, tools: [tool] };
    expect(parseMessage(result, 'panel').ok).toBe(true);
    const bad = { ...tool, form: { autosubmit: false, sensitive: ['secret'] } };
    expect(parseMessage({ ...result, tools: [bad] }, 'panel').ok).toBe(false);
  });
});

describe('hints and forms on the wire', () => {
  it('keeps the debugging hint and drops a hint that is not a boolean', async () => {
    const context = {
      getTools: () =>
        Promise.resolve([entry('d', { annotations: { debugging: true, readOnlyHint: 'yes' } })]),
    };
    const { runtime } = tab(context);
    expect((await list(runtime)).tools[0]?.annotations).toEqual({ debugging: true });
  });

  it('adds what the page DOM says about a form tool', async () => {
    const context = { getTools: () => Promise.resolve([entry('wait'), entry('other')]) };
    const form = {
      getAttribute: (n: string) => (n === 'toolname' ? 'wait' : null),
      hasAttribute: () => false,
      querySelectorAll: () => [],
    };
    const { runtime } = tab(context, { querySelectorAll: () => [form] });
    const tools = (await list(runtime)).tools;
    expect(tools.find((t) => t.name === 'wait')?.form).toEqual({
      autosubmit: false,
      sensitive: [],
    });
    expect(tools.find((t) => t.name === 'other')?.form).toBeUndefined();
  });
});
