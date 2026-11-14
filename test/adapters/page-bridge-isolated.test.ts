// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  NOTICE_INTERVAL_MS,
  OTHER_SITE_TEXT,
  startIsolatedRelay,
} from '../../src/adapters/page-bridge-isolated';
import { startMainBridge } from '../../src/adapters/page-bridge-main';
import { AGSC_TOOLS } from '../helpers';
import { FakeContentRuntime, FakeModelContext, FakeWindow, settle } from './bridge-bus';

const CHANNEL = 'aaaaaaaa-1111-4bbb-8ccc-222222222222';
const ORIGIN = 'https://node.example';

function setup(options: { origin?: string; linkset?: boolean; timeoutMs?: number } = {}) {
  const win = new FakeWindow(options.origin ?? ORIGIN);
  const runtime = new FakeContentRuntime();
  let n = 0;
  startIsolatedRelay({
    win,
    runtime,
    channel: CHANNEL,
    newId: () => `p${(n += 1)}`,
    location: { origin: options.origin ?? ORIGIN },
    hasLinkset: () => options.linkset ?? false,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
  return { win, runtime };
}

describe('startIsolatedRelay', () => {
  it('relays tools/list to the MAIN script and adds the origin and the linkset flag', async () => {
    const { win, runtime } = setup({ linkset: true });
    startMainBridge(win, () => new FakeModelContext(ORIGIN, AGSC_TOOLS));
    const reply = (await runtime.deliver({ type: 'tools/list', id: 'w1', tabId: 3 })) as Record<
      string,
      unknown
    >;
    expect(reply).toMatchObject({
      type: 'tools/list-result',
      id: 'w1',
      ok: true,
      origin: ORIGIN,
      linkset: true,
    });
    expect((reply.tools as unknown[]).length).toBe(10);
    const sent = win.posted[0] as { channel: string; message: { id: string; tabId?: number } };
    expect(sent.channel).toBe(CHANNEL);
    expect(sent.message.id).toBe('p1');
    expect(sent.message.tabId).toBeUndefined();
  });

  it('passes the WebMCP-interface flag of the MAIN script on', async () => {
    const { win, runtime } = setup();
    startMainBridge(win, () => undefined);
    const reply = (await runtime.deliver({ type: 'tools/list', id: 'w3', tabId: 3 })) as Record<
      string,
      unknown
    >;
    expect(reply).toMatchObject({ ok: true, webmcp: false });
  });

  it('relays tools/call and re-addresses the reply to the request id', async () => {
    const { win, runtime } = setup();
    const context = new FakeModelContext(ORIGIN, AGSC_TOOLS);
    startMainBridge(win, () => context);
    const reply = await runtime.deliver({
      type: 'tools/call',
      id: 'w2',
      name: 'read',
      args: { slug: 'a' },
    });
    expect(reply).toMatchObject({ type: 'tools/call-result', id: 'w2', ok: true });
    expect(context.executed).toEqual([{ name: 'read', args: { slug: 'a' } }]);
  });

  it('replaces any origin the page claims, and leaves it out for a non-http origin', async () => {
    const { win, runtime } = setup({ origin: 'null' });
    win.addEventListener('message', (event) => {
      const data = event.data as { message?: { type?: string; id?: string } };
      if (data.message?.type !== 'tools/list') return;
      win.postMessage(
        {
          source: 'webaiassist',
          channel: CHANNEL,
          message: {
            type: 'tools/list-result',
            id: data.message.id,
            ok: true,
            tools: [],
            origin: 'https://bank.example',
            linkset: true,
          },
        },
        '*',
      );
    });
    const reply = await runtime.deliver({ type: 'tools/list', id: 'w3' });
    expect(reply).toEqual({
      type: 'tools/list-result',
      id: 'w3',
      ok: true,
      tools: [],
      linkset: false,
    });
  });

  it('answers with an error when the page does not reply in time', async () => {
    const { runtime } = setup({ timeoutMs: 20 });
    expect(await runtime.deliver({ type: 'tools/list', id: 'w4' })).toEqual({
      type: 'tools/list-result',
      id: 'w4',
      ok: false,
      tools: [],
      error: 'The page did not answer in time.',
    });
    expect(await runtime.deliver({ type: 'tools/call', id: 'w5', name: 'x', args: {} })).toEqual({
      type: 'tools/call-result',
      id: 'w5',
      ok: false,
      text: 'The page did not answer in time.',
    });
  });

  it('ignores replies on another channel, with another id, or failing the schema', async () => {
    const { win, runtime } = setup({ timeoutMs: 60 });
    const pending = runtime.deliver({ type: 'tools/call', id: 'w6', name: 'x', args: {} });
    await settle(1);
    const reply = (channel: string, message: object) =>
      win.postMessage({ source: 'webaiassist', channel, message }, '*');
    reply('bbbbbbbb-1111-4bbb-8ccc-222222222222', {
      type: 'tools/call-result',
      id: 'p1',
      ok: true,
      text: 'a',
    });
    reply(CHANNEL, { type: 'tools/call-result', id: 'p9', ok: true, text: 'b' });
    reply(CHANNEL, { type: 'tools/call-result', id: 'p1', ok: 'yes', text: 'c' });
    win.postMessage('noise', '*');
    expect(await pending).toMatchObject({ ok: false, text: 'The page did not answer in time.' });
  });

  it('ignores runtime messages that are not tool requests', async () => {
    const { runtime } = setup();
    await expect(runtime.deliver({ type: 'tools/changed' })).rejects.toThrow(/port closed/);
    await expect(runtime.deliver({ type: 'model/chat', id: 'm', messages: [] })).rejects.toThrow(
      /port closed/,
    );
  });

  it('forwards tools/changed from the MAIN script on its channel to the extension', async () => {
    const { win, runtime } = setup();
    win.postMessage(
      { source: 'webaiassist', channel: CHANNEL, message: { type: 'tools/changed' } },
      '*',
    );
    win.postMessage(
      {
        source: 'webaiassist',
        channel: 'bbbbbbbb-1111-4bbb-8ccc-222222222222',
        message: { type: 'tools/changed' },
      },
      '*',
    );
    await settle();
    expect(runtime.toExtension).toEqual([{ type: 'tools/changed' }]);
  });

  it('survives an extension that is not listening for tools/changed', async () => {
    const { win, runtime } = setup();
    const original = runtime.sendMessage.bind(runtime);
    runtime.sendMessage = () => Promise.reject(new Error('Receiving end does not exist.'));
    const changed = { source: 'webaiassist', channel: CHANNEL, message: { type: 'tools/changed' } };
    win.postMessage(changed, '*');
    await settle();
    expect(runtime.toExtension).toEqual([]);
    runtime.sendMessage = original;
    win.postMessage(changed, '*');
    // Notices are throttled: the second one inside the interval goes out when it ends.
    await new Promise((resolve) => setTimeout(resolve, NOTICE_INTERVAL_MS + 20));
    expect(runtime.toExtension).toEqual([{ type: 'tools/changed' }]);
  });
});

describe('startIsolatedRelay: a call is bound to its site', () => {
  it('refuses a call that names another site, without asking the page', async () => {
    const { win, runtime } = setup();
    const context = new FakeModelContext(ORIGIN, AGSC_TOOLS);
    startMainBridge(win, () => context);
    const call = { type: 'tools/call', id: 'w1', name: 'search', args: { query: 'x' } };
    const reply = await runtime.deliver({ ...call, origin: 'https://shop.example' });
    expect(reply).toEqual({
      type: 'tools/call-result',
      id: 'w1',
      ok: false,
      text: OTHER_SITE_TEXT,
    });
    expect(context.executed).toEqual([]);
    const same = await runtime.deliver({ ...call, id: 'w2', origin: ORIGIN });
    expect(same).toMatchObject({ id: 'w2', ok: true });
    expect(context.executed).toHaveLength(1);
  });

  it('sends one notice at once and one more at the end of the interval, however many fire', async () => {
    const { win, runtime } = setup();
    const changed = { source: 'webaiassist', channel: CHANNEL, message: { type: 'tools/changed' } };
    for (let i = 0; i < 50; i += 1) win.postMessage(changed, '*');
    await settle();
    expect(runtime.toExtension).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, NOTICE_INTERVAL_MS * 2 + 20));
    expect(runtime.toExtension).toHaveLength(2);
  });
});
