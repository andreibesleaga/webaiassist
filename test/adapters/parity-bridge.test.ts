// SPDX-License-Identifier: Apache-2.0
// The page bridge for the parity package: frames, the null result, Stop reaching the page's
// tool, form tools, and the cancel message on every hop.
import { describe, expect, it } from 'vitest';
import { MessagingToolBridge } from '../../src/adapters/messaging-tool-bridge';
import { startIsolatedRelay } from '../../src/adapters/page-bridge-isolated';
import { NO_RESULT_TEXT, startMainBridge } from '../../src/adapters/page-bridge-main';
import type { ModelContextLike } from '../../src/adapters/webmcp-reader';
import { FakeContentRuntime, FakeWindow, settle } from './bridge-bus';

const ORIGIN = 'https://node.example';
const CHANNEL = 'aaaaaaaa-1111-4bbb-8ccc-222222222222';

const entry = (name: string, extra: object = {}) => ({
  name,
  description: `Tool ${name}.`,
  origin: ORIGIN,
  ...extra,
});

/** The relay and the MAIN bridge on one fake window, as in a tab. */
function tab(context: ModelContextLike) {
  const win = new FakeWindow(ORIGIN);
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

describe('tools of frames', () => {
  it('lists and runs only tools the top window registered; a same-origin frame tool is left out', async () => {
    const ran: string[] = [];
    const holder: { win?: unknown } = {};
    const frame = {};
    const context = {
      getTools: () =>
        Promise.resolve([
          entry('top_tool', { window: holder.win }),
          entry('frame_tool', { window: frame }),
          entry('no_window'),
        ]),
      executeTool: (e: { name: string }) => {
        ran.push(e.name);
        return Promise.resolve('ok');
      },
    };
    const { win, runtime } = tab(context);
    holder.win = win;
    expect((await list(runtime)).tools.map((t) => t.name)).toEqual(['top_tool', 'no_window']);
    const call = (name: string) =>
      runtime.deliver({
        type: 'tools/call',
        id: `c-${name}`,
        tabId: 1,
        origin: ORIGIN,
        name,
        args: {},
      });
    expect(await call('frame_tool')).toMatchObject({ ok: false });
    expect(await call('top_tool')).toMatchObject({ ok: true, text: 'ok' });
    expect(ran).toEqual(['top_tool']);
  });

  it('a frame cannot take the name of a top tool', async () => {
    const holder: { win?: unknown } = {};
    const context = {
      getTools: () =>
        Promise.resolve([
          entry('pay', { window: holder.win }),
          entry('pay', { window: {}, description: 'A frame says pay is something else.' }),
        ]),
      executeTool: () => Promise.resolve('ran'),
    };
    const { win, runtime } = tab(context);
    holder.win = win;
    expect((await list(runtime)).tools.map((t) => t.name)).toEqual(['pay']);
  });
});

describe('the result of a tool', () => {
  const callWith = async (result: unknown) => {
    const context = {
      getTools: () => Promise.resolve([entry('t')]),
      executeTool: () => Promise.resolve(result),
    };
    const { runtime } = tab(context);
    return runtime.deliver({
      type: 'tools/call',
      id: 'c1',
      tabId: 1,
      origin: ORIGIN,
      name: 't',
      args: {},
    });
  };

  it('a null result (the page navigated) and an undefined one read as one plain sentence', async () => {
    expect(await callWith(null)).toMatchObject({ ok: true, text: NO_RESULT_TEXT });
    expect(await callWith(undefined)).toMatchObject({ ok: true, text: NO_RESULT_TEXT });
    // Chrome's executeTool gives a null result back as the text "null" (seen in Chromium 156).
    expect(await callWith('null')).toMatchObject({ ok: true, text: NO_RESULT_TEXT });
    expect(NO_RESULT_TEXT).toContain('the page navigated');
    expect(NO_RESULT_TEXT).not.toMatch(/null/i);
  });

  it('other results keep their form: a number, an object, an empty string', async () => {
    expect(await callWith(5)).toMatchObject({ text: '5' });
    expect(await callWith({ a: 1 })).toMatchObject({ text: '{"a":1}' });
    expect(await callWith('')).toMatchObject({ text: '' });
  });
});

describe('Stop reaches the running tool', () => {
  function slow() {
    const seen: string[] = [];
    let signal: AbortSignal | undefined;
    const context = {
      getTools: () => Promise.resolve([entry('slow')]),
      executeTool: (_e: unknown, _i: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          signal = options?.signal;
          signal?.addEventListener('abort', () => {
            seen.push('aborted');
            reject(new Error('aborted'));
          });
        }),
    };
    return { context, seen, signal: () => signal };
  }

  it('passes an abort signal to executeTool and aborts it on tools/cancel', async () => {
    const { context, seen, signal } = slow();
    const { runtime } = tab(context);
    const call = runtime.deliver({
      type: 'tools/call',
      id: 'c9',
      tabId: 1,
      origin: ORIGIN,
      name: 'slow',
      args: {},
    });
    await settle();
    expect(signal()?.aborted).toBe(false);
    const ack = await runtime.deliver({ type: 'tools/cancel', id: 'c9', tabId: 1 });
    expect(ack).toEqual({ type: 'tools/call-result', id: 'c9', ok: true, text: '' });
    await settle();
    expect(seen).toEqual(['aborted']);
    expect(await call).toMatchObject({ ok: false });
  });

  it('a cancel for a call that is not running does nothing', async () => {
    const { context, seen } = slow();
    const { runtime } = tab(context);
    expect(await runtime.deliver({ type: 'tools/cancel', id: 'zzz', tabId: 1 })).toMatchObject({
      ok: true,
    });
    expect(seen).toEqual([]);
  });

  it('a call the page does not answer in time is told to stop as well', async () => {
    const { context, seen } = slow();
    const win = new FakeWindow(ORIGIN);
    const runtime = new FakeContentRuntime();
    let n = 0;
    startIsolatedRelay({
      win,
      runtime,
      channel: CHANNEL,
      newId: () => `q${(n += 1)}`,
      location: { origin: ORIGIN },
      hasLinkset: () => false,
      timeoutMs: 30,
    });
    startMainBridge(win, () => context);
    const reply = await runtime.deliver({
      type: 'tools/call',
      id: 'c8',
      tabId: 1,
      origin: ORIGIN,
      name: 'slow',
      args: {},
    });
    expect(reply).toMatchObject({ ok: false, text: 'The page did not answer in time.' });
    await settle();
    expect(seen).toEqual(['aborted']);
  });

  it('the panel bridge sends tools/cancel when its signal aborts during a call, and not after', async () => {
    const sent: Record<string, unknown>[] = [];
    let release: (value: unknown) => void = () => undefined;
    const bridge = new MessagingToolBridge(
      (message) => {
        sent.push(message as Record<string, unknown>);
        const type = (message as { type: string }).type;
        return type === 'tools/call'
          ? new Promise((resolve) => (release = resolve))
          : Promise.resolve(undefined);
      },
      () => 'id1',
    );
    const controller = new AbortController();
    const pending = bridge.call({ tabId: 4, origin: ORIGIN }, 'slow', {}, controller.signal);
    await settle(2);
    controller.abort();
    await settle(2);
    expect(sent.map((m) => m.type)).toEqual(['tools/call', 'tools/cancel']);
    expect(sent[1]).toEqual({ type: 'tools/cancel', id: 'id1', tabId: 4 });
    release({ type: 'tools/call-result', id: 'id1', ok: false, text: 'Tool error: x' });
    expect(await pending).toEqual({ ok: false, text: 'Tool error: x' });
  });

  it('the panel bridge sends nothing when Stop came before the call, and no cancel after a finished call', async () => {
    const sent: Record<string, unknown>[] = [];
    const bridge = new MessagingToolBridge(
      (message) => {
        sent.push(message as Record<string, unknown>);
        return Promise.resolve({ type: 'tools/call-result', id: 'id1', ok: true, text: 'done' });
      },
      () => 'id1',
    );
    const early = new AbortController();
    early.abort();
    expect(await bridge.call({ tabId: 1, origin: ORIGIN }, 't', {}, early.signal)).toMatchObject({
      ok: false,
    });
    expect(sent).toEqual([]);
    const later = new AbortController();
    await bridge.call({ tabId: 1, origin: ORIGIN }, 't', {}, later.signal);
    later.abort();
    await settle(2);
    expect(sent.map((m) => m.type)).toEqual(['tools/call']);
  });
});
