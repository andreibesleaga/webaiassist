// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Fixture replay: the ten tools of an AgenticSystemCore node page (fixtures/agsc-tools.json)
// go through the whole message path, MAIN-world script -> isolated content script ->
// service-worker router -> panel bridge -> agent loop -> side panel UI, with a fake model
// that emits the tool call and then an answer. Every message on the way is checked
// against its schema by the real code; only chrome.* and the page window are in-memory.
import { beforeEach, describe, expect, it } from 'vitest';
import { MessagingToolBridge } from '../../src/adapters/messaging-tool-bridge';
import { startIsolatedRelay } from '../../src/adapters/page-bridge-isolated';
import { startMainBridge } from '../../src/adapters/page-bridge-main';
import { routeToolRequest } from '../../src/adapters/tool-router';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { parseMessage } from '../../src/protocol/validate';
import { startPanel } from '../../src/ui/panel-controller';
import { FakeContentRuntime, FakeModelContext, FakeWindow, settle } from '../adapters/bridge-bus';
import { AGSC_TOOLS, answer, call } from '../helpers';
import { byId, loadPage } from '../ui/dom';
import { fakeDeps, ORIGIN } from '../ui/panel-fakes';

const TAB = 7;

/** One valid call per tool, matching its inputSchema. */
const CALLS: Record<string, object> = {
  ask: { question: 'What is a handoff?' },
  brief: { selection: ['handoff'] },
  check: { selection: ['handoff'] },
  compose: { selection: ['handoff', 'review'] },
  explain: { key: 'requires', source: 'handoff', target: 'review' },
  links: { slug: 'handoff' },
  propose: { slug: 'task-1' },
  read: { slug: 'handoff' },
  remember: { body: 'Keep reviews short.', kind: 'note', title: 'Reviews' },
  search: { query: 'handoff' },
};

/** The page (MAIN + isolated scripts) and the service worker, wired over in-memory buses. */
function nodePage() {
  const win = new FakeWindow(ORIGIN);
  const context = new FakeModelContext(ORIGIN, AGSC_TOOLS);
  const content = new FakeContentRuntime();
  let n = 0;
  startMainBridge(win, () => context);
  startIsolatedRelay({
    win,
    runtime: content,
    channel: 'aaaaaaaa-1111-4bbb-8ccc-222222222222',
    newId: () => `p${(n += 1)}`,
    location: { origin: ORIGIN },
    hasLinkset: () => true,
  });
  const worker = async (message: object): Promise<unknown> => {
    const parsed = parseMessage(message, 'panel');
    if (!parsed.ok) throw new Error(parsed.error);
    const request = parsed.value;
    if (request.type !== 'tools/list' && request.type !== 'tools/call')
      throw new Error('not routed');
    return routeToolRequest(request, {
      sendToTab: (tabId, m) =>
        tabId === TAB ? content.deliver(m) : Promise.reject(new Error('no tab')),
      inject: () => Promise.resolve(),
    });
  };
  let id = 0;
  const bridge = new MessagingToolBridge(worker, () => `b${(id += 1)}`);
  return { context, bridge };
}

/** Clicks Allow on every question the panel asks until the run ends; returns the titles. */
async function allowEverything(): Promise<string[]> {
  const titles: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    await settle(1);
    const dialog = byId<HTMLDialogElement>('confirm');
    if (dialog.open) {
      titles.push(byId('confirm-title').textContent ?? '');
      byId('confirm-allow').click();
    }
  }
  return titles;
}

const SECOND_QUESTION = new Set(['propose', 'remember']);

describe('fixture replay: the ten AgenticSystemCore tools through the whole message path', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('lists the ten tools of the node page and detects node mode', async () => {
    const { bridge } = nodePage();
    const deps = { ...fakeDeps([]), bridge };
    await startPanel(deps);
    expect(byId('page-status').textContent).toBe(
      'node.example — says it is an AgenticSystemCore node, 10 WebMCP tools',
    );
  });

  it.each(Object.keys(CALLS))('replays %s: gate, call, untrusted result, answer', async (name) => {
    const { context, bridge } = nodePage();
    const deps = {
      ...fakeDeps([call(name, CALLS[name] ?? {}), answer(`Done with ${name}.`)]),
      bridge,
    };
    const model = deps.model as FakeModelRuntime;
    await startPanel(deps);
    byId('start').click();
    await settle();
    byId<HTMLTextAreaElement>('question').value = `Use ${name}`;
    byId<HTMLFormElement>('ask').requestSubmit();
    const titles = await allowEverything();

    // A tool the page marks as consequential is asked about a second time.
    const again = SECOND_QUESTION.has(name) ? [`Are you sure about ${name}?`] : [];
    expect(titles).toEqual([`Use the tools of ${ORIGIN}?`, `Run the tool ${name}?`, ...again]);
    expect(context.executed).toEqual([{ name, args: CALLS[name] }]);
    const result = byId('transcript').querySelector('[data-trust="untrusted"] pre')?.textContent;
    expect(JSON.parse(result ?? '{}')).toMatchObject({ source: name, trust: 'untrusted' });
    expect(byId('transcript').textContent).toContain(`Done with ${name}.`);
    const seen = model.requests[1]?.messages.at(-2)?.content ?? '';
    expect(seen).toMatch(new RegExp(`^<tool-result tool="${name}" trust="untrusted">`));
    expect(model.requests[0]?.messages[0]?.content).toContain('AgenticSystemCore node');
    expect(await deps.memoryStore.history(ORIGIN)).toEqual([
      { tool: name, ok: 1, failed: 0, lastAt: '2026-01-15T10:00:00.000Z' },
    ]);
  });
});
