// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { startMainBridge } from '../../src/adapters/page-bridge-main';
import type { ModelContextLike } from '../../src/adapters/webmcp-reader';
import { AGSC_TOOLS } from '../helpers';
import { FakeModelContext, FakeWindow, settle } from './bridge-bus';

const CHANNEL = 'c0ffee00-1234-4abc-8def-0123456789ab';
const ORIGIN = 'https://node.example';

const envelope = (message: object, channel = CHANNEL) => ({
  source: 'webaiassist',
  channel,
  message,
});

type Reply = { channel: string; message: Record<string, unknown> };

/** Replies the MAIN bridge posted (everything except the requests the test posted). */
function replies(win: FakeWindow): Reply[] {
  return (win.posted as Partial<Reply>[]).filter((p): p is Reply =>
    /-result$|changed$/.test(String(p?.message?.type)),
  );
}

function setup(context: ModelContextLike | undefined) {
  const win = new FakeWindow(ORIGIN);
  startMainBridge(win, () => context);
  return win;
}

async function ask(win: FakeWindow, message: object): Promise<Record<string, unknown>> {
  win.postMessage(envelope(message), '*');
  await settle();
  const reply = replies(win).at(-1);
  if (!reply) throw new Error('no reply');
  return reply.message;
}

describe('startMainBridge: tools/list', () => {
  it('lists the ten node tools with their schemas and hints, on the same channel and id', async () => {
    const win = setup(new FakeModelContext(ORIGIN, AGSC_TOOLS));
    const reply = await ask(win, { type: 'tools/list', id: 'l1' });
    expect(reply).toMatchObject({ type: 'tools/list-result', id: 'l1', ok: true });
    const tools = reply.tools as { name: string }[];
    expect(tools.map((t) => t.name)).toEqual(AGSC_TOOLS.map((t) => t.name));
    expect(tools).toContainEqual(AGSC_TOOLS.find((t) => t.name === 'propose'));
    expect(replies(win)[0]?.channel).toBe(CHANNEL);
  });

  it('keeps the three hints (an unclear consequentialHint as true), a title and an object schema', async () => {
    const page = {
      getTools: () =>
        Promise.resolve([
          {
            name: 'a',
            title: '',
            description: 'd',
            inputSchema: 'not an object',
            annotations: { readOnlyHint: true, debugging: true, consequentialHint: 'yes' },
          },
          { name: 'b', title: 'Bee', description: 'e', inputSchema: [] },
          { name: 'c', description: 'f', inputSchema: { type: 'object' } },
          { name: '', description: 'no name' },
          { name: 'd' },
          null,
        ]),
    };
    const reply = await ask(setup(page), { type: 'tools/list', id: 'l2' });
    expect(reply.tools).toEqual([
      { name: 'a', description: 'd', annotations: { readOnlyHint: true, consequentialHint: true } },
      { name: 'b', title: 'Bee', description: 'e' },
      { name: 'c', description: 'f', inputSchema: { type: 'object' } },
    ]);
  });

  it('caps the list at 256 tools and a long description at 10000 characters', async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      name: `t${i}`,
      description: 'x'.repeat(20000),
    }));
    const reply = await ask(setup({ getTools: () => Promise.resolve(many) }), {
      type: 'tools/list',
      id: 'l3',
    });
    const tools = reply.tools as { description: string }[];
    expect(tools).toHaveLength(256);
    expect(tools[0]?.description).toHaveLength(10000);
  });

  it('lists no tools, without an error, when the page has no modelContext; says so when getTools fails', async () => {
    expect(await ask(setup(undefined), { type: 'tools/list', id: 'l4' })).toEqual({
      type: 'tools/list-result',
      id: 'l4',
      ok: true,
      tools: [],
      webmcp: false,
    });
    const broken = { getTools: () => Promise.reject(new Error('NotAllowedError')) };
    const reply = await ask(setup(broken), { type: 'tools/list', id: 'l5' });
    expect(reply).toMatchObject({ ok: false, tools: [] });
    expect(String(reply.error)).toContain('NotAllowedError');
    const odd = { getTools: () => Promise.resolve('nope') };
    expect((await ask(setup(odd), { type: 'tools/list', id: 'l6' })).ok).toBe(false);
  });

  it('skips a tool whose schema cannot be copied', async () => {
    const circular: Record<string, unknown> = { type: 'object' };
    circular.self = circular;
    const page = {
      getTools: () => Promise.resolve([{ name: 'f', description: 'd', inputSchema: circular }]),
    };
    expect((await ask(setup(page), { type: 'tools/list', id: 'l7' })).tools).toEqual([]);
  });
});

describe('startMainBridge: tools/call', () => {
  it('runs the tool through executeTool and returns its string', async () => {
    const context = new FakeModelContext(ORIGIN, AGSC_TOOLS, (name) => ({
      tool: name,
      trust: 'untrusted',
    }));
    const win = setup(context);
    const reply = await ask(win, {
      type: 'tools/call',
      id: 'c1',
      name: 'search',
      args: { query: 'q' },
    });
    expect(reply).toEqual({
      type: 'tools/call-result',
      id: 'c1',
      ok: true,
      text: '{"tool":"search","trust":"untrusted"}',
    });
    expect(context.executed).toEqual([{ name: 'search', args: { query: 'q' } }]);
  });

  it('stringifies a non-string result and caps the text', async () => {
    const page = {
      getTools: () => Promise.resolve([{ name: 'n', description: 'd', origin: ORIGIN }]),
      executeTool: () => Promise.resolve('y'.repeat(1_000_010)),
    };
    const reply = await ask(setup(page), { type: 'tools/call', id: 'c2', name: 'n', args: {} });
    expect(String(reply.text)).toHaveLength(1_000_000);
    const numeric = { ...page, executeTool: () => Promise.resolve(42) };
    const second = await ask(setup(numeric), { type: 'tools/call', id: 'c3', name: 'n', args: {} });
    expect(second.text).toBe('42');
  });

  it('refuses a tool of another origin and an unknown tool', async () => {
    const page = {
      getTools: () =>
        Promise.resolve([{ name: 'x', description: 'd', origin: 'https://evil.example' }]),
      executeTool: () => Promise.resolve('ran'),
    };
    const win = setup(page);
    const reply = await ask(win, { type: 'tools/call', id: 'c4', name: 'x', args: {} });
    expect(reply).toMatchObject({ ok: false, text: 'Tool error: x: no such tool on this page' });
  });

  it('reports a tool that throws, and a page without the API', async () => {
    const page = {
      getTools: () => Promise.resolve([{ name: 'x', description: 'd' }]),
      executeTool: () => Promise.reject(new Error('boom')),
    };
    const reply = await ask(setup(page), { type: 'tools/call', id: 'c5', name: 'x', args: {} });
    expect(reply).toMatchObject({ ok: false, text: 'Tool error: x: boom' });
    const none = await ask(setup(undefined), { type: 'tools/call', id: 'c6', name: 'x', args: {} });
    expect(none).toMatchObject({ ok: false });
    const half = await ask(
      setup({ getTools: () => Promise.resolve([{ name: 'x', description: 'd' }]) }),
      {
        type: 'tools/call',
        id: 'c7',
        name: 'x',
        args: {},
      },
    );
    expect(half).toMatchObject({ ok: false });
  });
});

describe('startMainBridge: guards and changes', () => {
  it('ignores invalid envelopes, results and messages from other sources', async () => {
    const win = setup(new FakeModelContext(ORIGIN, AGSC_TOOLS));
    win.postMessage(
      { source: 'other', channel: CHANNEL, message: { type: 'tools/list', id: 'x' } },
      '*',
    );
    win.postMessage(envelope({ type: 'tools/list', id: 'x', extra: 1 }), '*');
    win.postMessage(envelope({ type: 'tools/call-result', id: 'x', ok: true, text: '' }), '*');
    win.postMessage(envelope({ type: 'model/chat', id: 'x', messages: [] }), '*');
    win.postMessage('hello', '*');
    await settle();
    expect(replies(win).filter((r) => r.message.type !== 'tools/call-result')).toEqual([]);
    expect(win.posted).toHaveLength(5);
  });

  it('starts once per window', async () => {
    const win = new FakeWindow(ORIGIN);
    const context = new FakeModelContext(ORIGIN, AGSC_TOOLS);
    startMainBridge(win, () => context);
    startMainBridge(win, () => context);
    win.postMessage(envelope({ type: 'tools/list', id: 'once' }), '*');
    await settle();
    expect(replies(win)).toHaveLength(1);
  });

  it('posts tools/changed on the last channel when the page changes its tools', async () => {
    const context = new FakeModelContext(ORIGIN, AGSC_TOOLS);
    const win = setup(context);
    context.replace([]);
    await settle();
    expect(replies(win)).toEqual([]);
    await ask(win, { type: 'tools/list', id: 'l8' });
    context.replace(AGSC_TOOLS.slice(0, 1));
    await settle();
    expect(replies(win).at(-1)).toEqual({
      source: 'webaiassist',
      channel: CHANNEL,
      message: { type: 'tools/changed' },
    });
  });

  it('works with a registry that has no addEventListener (some polyfills)', async () => {
    const page = { getTools: () => Promise.resolve([]) };
    const reply = await ask(setup(page), { type: 'tools/list', id: 'l9' });
    expect(reply).toMatchObject({ ok: true, tools: [] });
  });
});

describe('startMainBridge: one rule for listing and running', () => {
  /** A registry that returns the given entries as they are. */
  const raw = (entries: Record<string, unknown>[]) => {
    const ran: unknown[] = [];
    const context = {
      getTools: () => Promise.resolve(entries),
      executeTool: (entry: unknown) => {
        ran.push((entry as { description: string }).description);
        return Promise.resolve('done');
      },
    } as unknown as ModelContextLike;
    return { context, ran };
  };

  it('lists and runs neither another origin’s entry nor a name used twice', async () => {
    const { context, ran } = raw([
      { name: 'price', origin: 'https://ads.example', description: 'Other site.' },
      { name: 'pay', origin: ORIGIN, description: 'Pays.' },
      { name: 'pay', description: 'Also pay.' },
      { name: 'read', description: 'Reads.' },
    ]);
    const win = setup(context);
    const list = await ask(win, { type: 'tools/list', id: 'l1' });
    expect((list.tools as { name: string }[]).map((t) => t.name)).toEqual(['read']);
    const pay = await ask(win, { type: 'tools/call', id: 'c1', name: 'pay', args: {} });
    expect(pay).toMatchObject({ ok: false });
    const price = await ask(win, { type: 'tools/call', id: 'c2', name: 'price', args: {} });
    expect(price).toMatchObject({ ok: false });
    expect(ran).toEqual([]);
  });
});

describe('startMainBridge: requests from another frame (audit H1)', () => {
  const FRAME = { frame: 'ad' };
  const OTHER = 'ffffffff-1111-4222-8333-444444444444';

  it('ignores a call posted by a frame: the tool does not run and nothing is posted', async () => {
    const context = new FakeModelContext(ORIGIN, AGSC_TOOLS);
    const win = setup(context);
    const call = { type: 'tools/call', id: 'f1', name: 'propose', args: {} };
    win.dispatchFrom(FRAME, envelope(call, OTHER));
    win.dispatchFrom(undefined, envelope(call, OTHER));
    await settle();
    expect(context.executed).toEqual([]);
    expect(win.posted).toEqual([]);
  });

  it('answers a list request on its own channel, whatever a frame sends meanwhile', async () => {
    const win = setup(new FakeModelContext(ORIGIN, AGSC_TOOLS));
    win.postMessage(envelope({ type: 'tools/list', id: 'l1' }), '*');
    win.dispatchFrom(FRAME, envelope({ type: 'tools/list', id: 'f2' }, OTHER));
    await settle();
    const answers = replies(win);
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({ channel: CHANNEL, message: { id: 'l1' } });
  });

  it('posts each reply on the channel of its own request', async () => {
    const win = setup(new FakeModelContext(ORIGIN, AGSC_TOOLS));
    win.postMessage(envelope({ type: 'tools/list', id: 'a' }), '*');
    win.postMessage(envelope({ type: 'tools/list', id: 'b' }, OTHER), '*');
    await settle();
    const channels = replies(win).map((r) => [String(r.message.id), r.channel]);
    expect(Object.fromEntries(channels)).toEqual({ a: CHANNEL, b: OTHER });
  });
});
