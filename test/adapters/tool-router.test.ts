// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { NOT_ALLOWED_TEXT, RESTRICTED_TEXT } from '../../src/adapters/page-access';
import { routeToolRequest, type TabDeps } from '../../src/adapters/tool-router';

class FakeTab implements TabDeps {
  injected = 0;
  readonly sent: { tabId: number; message: object }[] = [];
  constructor(
    private readonly answer: (message: Record<string, unknown>) => unknown,
    private ready = false,
    private readonly canInject = true,
    private readonly refusal = 'Cannot access contents of the page.',
  ) {}
  sendToTab(tabId: number, message: object): Promise<unknown> {
    this.sent.push({ tabId, message });
    if (!this.ready) return Promise.reject(new Error('Receiving end does not exist.'));
    return Promise.resolve(this.answer(message as Record<string, unknown>));
  }
  inject(): Promise<void> {
    this.injected += 1;
    if (!this.canInject) return Promise.reject(new Error(this.refusal));
    this.ready = true;
    return Promise.resolve();
  }
}

const listOk = (m: Record<string, unknown>) => ({
  type: 'tools/list-result',
  id: m.id,
  ok: true,
  tools: [],
  origin: 'https://node.example',
});

describe('routeToolRequest', () => {
  it('injects the page scripts on first use, then retries and returns the page reply', async () => {
    const tab = new FakeTab(listOk);
    const reply = await routeToolRequest({ type: 'tools/list', id: 'r1', tabId: 5 }, tab);
    expect(reply).toEqual(listOk({ id: 'r1' }));
    expect(tab.injected).toBe(1);
    expect(tab.sent).toEqual([
      { tabId: 5, message: { type: 'tools/list', id: 'r1' } },
      { tabId: 5, message: { type: 'tools/list', id: 'r1' } },
    ]);
  });

  it('does not inject again when the scripts already answer', async () => {
    const tab = new FakeTab(
      (m) => ({ type: 'tools/call-result', id: m.id, ok: true, text: 'r' }),
      true,
    );
    const origin = 'https://node.example';
    const call = {
      type: 'tools/call',
      id: 'r2',
      tabId: 5,
      origin,
      name: 's',
      args: { q: 1 },
    } as const;
    expect(await routeToolRequest(call, tab)).toEqual({
      type: 'tools/call-result',
      id: 'r2',
      ok: true,
      text: 'r',
    });
    expect(tab.injected).toBe(0);
    expect(tab.sent[0]?.message).toEqual({
      type: 'tools/call',
      id: 'r2',
      origin,
      name: 's',
      args: { q: 1 },
    });
  });

  it('refuses a call that names no site', async () => {
    const tab = new FakeTab(listOk, true);
    const call = { type: 'tools/call', id: 'r8', tabId: 5, name: 's', args: {} } as const;
    expect(await routeToolRequest(call, tab)).toMatchObject({ ok: false });
    expect(tab.sent).toEqual([]);
  });

  it('says the site is not allowed yet when the scripts cannot be injected', async () => {
    const tab = new FakeTab(listOk, false, false);
    expect(await routeToolRequest({ type: 'tools/list', id: 'r3', tabId: 5 }, tab)).toEqual({
      type: 'tools/list-result',
      id: 'r3',
      ok: false,
      tools: [],
      error: NOT_ALLOWED_TEXT,
      access: 'denied',
    });
    const call = {
      type: 'tools/call',
      id: 'r4',
      tabId: 5,
      origin: 'https://node.example',
      name: 's',
      args: {},
    } as const;
    expect(await routeToolRequest(call, tab)).toEqual({
      type: 'tools/call-result',
      id: 'r4',
      ok: false,
      text: NOT_ALLOWED_TEXT,
    });
  });

  it('says the extension cannot run on a browser page or the store', async () => {
    const tab = new FakeTab(listOk, false, false, 'Cannot access a chrome:// URL');
    expect(await routeToolRequest({ type: 'tools/list', id: 'r9', tabId: 5 }, tab)).toEqual({
      type: 'tools/list-result',
      id: 'r9',
      ok: false,
      tools: [],
      error: RESTRICTED_TEXT,
      access: 'restricted',
    });
  });

  it('reports a page that still does not answer after injection', async () => {
    const tab: TabDeps = {
      sendToTab: () => Promise.reject(new Error('Receiving end does not exist.')),
      inject: () => Promise.resolve(),
    };
    const reply = await routeToolRequest({ type: 'tools/list', id: 'r5', tabId: 1 }, tab);
    expect(reply).toMatchObject({ ok: false });
    expect(JSON.stringify(reply)).toContain('Receiving end does not exist.');
  });

  it('says the page did not answer when the page closes during a tool call (F13.5)', async () => {
    const tab: TabDeps = {
      sendToTab: () => Promise.reject(new Error('The message port closed before a response.')),
      inject: () => Promise.resolve(),
    };
    const call = {
      type: 'tools/call',
      id: 'r6',
      tabId: 1,
      origin: 'https://node.example',
      name: 'add',
      args: {},
    } as const;
    const reply = await routeToolRequest(call, tab);
    expect(reply).toMatchObject({ type: 'tools/call-result', id: 'r6', ok: false });
    expect(JSON.stringify(reply)).toContain('The page did not answer');
  });

  it('needs a tab id', async () => {
    const tab = new FakeTab(listOk, true);
    expect(await routeToolRequest({ type: 'tools/list', id: 'r6' }, tab)).toMatchObject({
      ok: false,
      error: 'No tab was given.',
    });
    expect(tab.sent).toEqual([]);
  });

  it('refuses a reply with the wrong type, the wrong id or extra fields', async () => {
    const cases: unknown[] = [
      { type: 'tools/call-result', id: 'r7', ok: true, text: '' },
      { type: 'tools/list-result', id: 'other', ok: true, tools: [] },
      { type: 'tools/list-result', id: 'r7', ok: true, tools: [], script: 'x' },
      undefined,
    ];
    for (const answer of cases) {
      const reply = await routeToolRequest(
        { type: 'tools/list', id: 'r7', tabId: 2 },
        new FakeTab(() => answer, true),
      );
      expect(reply).toEqual({
        type: 'tools/list-result',
        id: 'r7',
        ok: false,
        tools: [],
        error: 'The page gave an answer WebAIAssist cannot use.',
      });
    }
  });
});
