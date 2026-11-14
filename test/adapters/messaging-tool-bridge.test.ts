// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { MessagingToolBridge, PageError } from '../../src/adapters/messaging-tool-bridge';
import { AGSC_TOOLS } from '../helpers';

function bridgeWith(answer: (message: Record<string, unknown>) => unknown) {
  const sent: Record<string, unknown>[] = [];
  let n = 0;
  const bridge = new MessagingToolBridge(
    (message) => {
      sent.push(message as Record<string, unknown>);
      return Promise.resolve(answer(message as Record<string, unknown>));
    },
    () => `b${(n += 1)}`,
  );
  return { bridge, sent };
}

const listResult = (m: Record<string, unknown>, extra: object = {}) => ({
  type: 'tools/list-result',
  id: m.id,
  ok: true,
  tools: AGSC_TOOLS,
  origin: 'https://node.example',
  ...extra,
});

describe('MessagingToolBridge', () => {
  it('asks the service worker for a tab’s tools and returns the page info', async () => {
    const { bridge, sent } = bridgeWith((m) => listResult(m, { linkset: true }));
    const page = await bridge.page(9);
    expect(sent).toEqual([{ type: 'tools/list', id: 'b1', tabId: 9 }]);
    expect(page.origin).toBe('https://node.example');
    expect(page.linkset).toBe(true);
    expect(page.tools).toEqual(AGSC_TOOLS);
    expect(await bridge.list(9)).toEqual({ origin: 'https://node.example', tools: AGSC_TOOLS });
  });

  it('passes on whether the page has a WebMCP interface; unknown stays unknown', async () => {
    const yes = bridgeWith((m) => listResult(m, { webmcp: true }));
    expect((await yes.bridge.page(1)).webmcp).toBe(true);
    const no = bridgeWith((m) => listResult(m, { webmcp: false }));
    expect((await no.bridge.page(1)).webmcp).toBe(false);
    const unknown = bridgeWith((m) => listResult(m));
    expect((await unknown.bridge.page(1)).webmcp).toBeUndefined();
  });

  it('drops empty optional fields of a tool', async () => {
    const tools = [
      {
        name: 'a',
        description: 'd',
        title: null,
        inputSchema: null,
        annotations: { readOnlyHint: null },
      },
    ];
    const { bridge } = bridgeWith((m) => listResult(m, { tools }));
    const page = await bridge.page(1);
    expect(page.tools).toEqual([{ name: 'a', description: 'd', annotations: {} }]);
    expect(page.linkset).toBe(false);
  });

  it('throws the page’s own error text when listing failed', async () => {
    const { bridge } = bridgeWith((m) => ({
      type: 'tools/list-result',
      id: m.id,
      ok: false,
      tools: [],
      error: 'WebAIAssist cannot reach this page.',
    }));
    await expect(bridge.page(1)).rejects.toThrow('WebAIAssist cannot reach this page.');
    const plain = bridgeWith((m) => ({
      type: 'tools/list-result',
      id: m.id,
      ok: false,
      tools: [],
    }));
    await expect(plain.bridge.page(1)).rejects.toThrow(/did not list its tools/);
  });

  it('throws on an unusable reply, a missing origin or a dead service worker', async () => {
    await expect(bridgeWith(() => ({ type: 'tools/list-result' })).bridge.page(1)).rejects.toThrow(
      /cannot use/,
    );
    await expect(
      bridgeWith((m) => ({ type: 'tools/list-result', id: m.id, ok: true, tools: [] })).bridge.page(
        1,
      ),
    ).rejects.toThrow(/which site/);
    const dead = new MessagingToolBridge(
      () => Promise.reject(new Error('no SW')),
      () => 'x1',
    );
    await expect(dead.page(1)).rejects.toThrow(/no SW/);
  });

  it('calls a tool and returns the page’s text', async () => {
    const { bridge, sent } = bridgeWith((m) => ({
      type: 'tools/call-result',
      id: m.id,
      ok: true,
      text: '{"trust":"untrusted"}',
    }));
    const target = { tabId: 4, origin: 'https://node.example' };
    expect(await bridge.call(target, 'search', { query: 'q' })).toEqual({
      ok: true,
      text: '{"trust":"untrusted"}',
    });
    expect(sent[0]).toEqual({
      type: 'tools/call',
      id: 'b1',
      tabId: 4,
      origin: 'https://node.example',
      name: 'search',
      args: { query: 'q' },
    });
  });

  it('turns a bad or missing call reply into a failed result', async () => {
    const bad = bridgeWith((m) => ({ type: 'tools/call-result', id: m.id, ok: 'no' }));
    const target = { tabId: 1, origin: 'https://node.example' };
    expect(await bad.bridge.call(target, 'x', {})).toEqual({
      ok: false,
      text: 'Tool error: the page gave an answer WebAIAssist cannot use.',
    });
    const dead = new MessagingToolBridge(
      () => Promise.reject(new Error('gone')),
      () => 'x2',
    );
    expect(await dead.call(target, 'x', {})).toEqual({ ok: false, text: 'Tool error: gone' });
  });

  it('tells listeners when a tab reports tools/changed, until they stop listening', () => {
    const { bridge } = bridgeWith(() => undefined);
    const seen: number[] = [];
    const stop = bridge.onChange((tabId) => seen.push(tabId));
    const top = (id: number) => ({ tab: { id }, frameId: 0 });
    bridge.notify({ type: 'tools/changed' }, top(7));
    bridge.notify({ type: 'tools/changed' }, {});
    bridge.notify({ type: 'tools/list', id: 'x' }, top(7));
    bridge.notify({ type: 'tools/changed', extra: 1 }, top(7));
    stop();
    bridge.notify({ type: 'tools/changed' }, top(8));
    expect(seen).toEqual([7]);
  });

  it('keeps the page origin on the error when the page has no tools, for compat mode', async () => {
    const { bridge } = bridgeWith((m) => ({
      ...listResult(m, { ok: false, error: 'This page has no WebMCP tools.' }),
      tools: [],
    }));
    const error: unknown = await bridge.page(9).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PageError);
    expect((error as PageError).origin).toBe('https://node.example');
    expect((error as PageError).message).toBe('This page has no WebMCP tools.');
    expect((error as PageError).access).toBeUndefined();
  });

  it('keeps why the service worker could not reach the page', async () => {
    for (const access of ['denied', 'restricted'] as const) {
      const { bridge } = bridgeWith((m) => ({
        type: 'tools/list-result',
        id: m.id,
        ok: false,
        tools: [],
        error: 'no access',
        access,
      }));
      const error: unknown = await bridge.page(9).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PageError);
      expect((error as PageError).access).toBe(access);
      expect((error as PageError).origin).toBeUndefined();
    }
  });
});
