// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// A tab that moves to another site, or another page of the same site, while a question is open.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import type { ChatRequest } from '../../src/core/ports/model-runtime';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { answer, call } from '../helpers';
import { byId, loadPage } from './dom';
import { fakeDeps, FakeSite, ORIGIN, type FakeDeps } from './panel-fakes';
import { ask, fakeClock, flush, open, startModel, text } from './site-helpers';

const OTHER = 'https://other.example';

/** A model that waits until the question is stopped. */
class WaitingModel extends FakeModelRuntime {
  override chat(request: ChatRequest): Promise<string> {
    return new Promise((resolve) => {
      (request.signal as AbortSignal | undefined)?.addEventListener('abort', () =>
        resolve(answer('too late')),
      );
    });
  }
}

function setup(model: FakeModelRuntime) {
  const site = new FakeSite();
  const deps = fakeDeps([], { site });
  deps.model = model;
  deps.grants.origins.add(ORIGIN);
  deps.bridge.pageByTab.set(8, { origin: OTHER, linkset: false, tools: [] });
  site.tabs.set(7, { title: 'Home', url: `${ORIGIN}/` });
  site.tabs.set(8, { title: 'Other', url: `${OTHER}/` });
  return { site, deps };
}

async function moveTo(deps: FakeDeps, site: FakeSite, tab: number): Promise<void> {
  deps.currentTab = tab;
  site.emit({ kind: 'tab-activated' });
  await vi.advanceTimersByTimeAsync(300);
  await flush();
}

describe('a running answer when the tab moves', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('stops with one plain line when the tab moves to another site', async () => {
    const { site, deps } = setup(new WaitingModel([]));
    await open(deps);
    await startModel();
    await ask('Question one');
    expect(byId<HTMLButtonElement>('stop').disabled).toBe(false);
    await moveTo(deps, site, 8);
    expect(byId<HTMLButtonElement>('stop').disabled).toBe(true);
    const lines = [...byId('transcript').querySelectorAll('li.note')].map((li) => li.textContent);
    expect(lines).toEqual(['Stopped: you switched to other.example.']);
    expect(byId('transcript').textContent).not.toContain('Error: Stopped.');
  });

  it('denies a call waiting in its dialog and says the call was not run', async () => {
    const model = new FakeModelRuntime([call('propose', { slug: 'a' }), answer('done')]);
    const { site, deps } = setup(model);
    await open(deps);
    await startModel();
    await ask('Propose something');
    // The page confirmation dialog for "propose" is open.
    expect(byId('confirm-title').textContent).toContain('propose');
    await moveTo(deps, site, 8);
    const lines = [...byId('transcript').querySelectorAll('li.note')].map((li) => li.textContent);
    expect(lines).toContain('The tab is now on another site; the call to propose was not run.');
    expect(lines).toContain('Stopped: you switched to other.example.');
    expect(deps.bridge.calls).toEqual([]);
  });

  it('does not stop for another page of the same site, and adds a note when it ends', async () => {
    const { site, deps } = setup(new FakeModelRuntime([]));
    const model = new WaitingModel([]);
    deps.model = model;
    await open(deps);
    await startModel();
    await ask('Question one');
    site.tabs.set(7, { title: 'Page two', url: `${ORIGIN}/two` });
    site.emit({ kind: 'tab-updated', tabId: 7, status: 'complete', url: `${ORIGIN}/two` });
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    expect(byId<HTMLButtonElement>('stop').disabled).toBe(false);
    byId('stop').click();
    await flush();
    const lines = [...byId('transcript').querySelectorAll('li')].map((li) => li.textContent);
    expect(lines.join('|')).toContain('Page changed to Page two.');
  });
});

describe('the chat belongs to the site', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the saved chat of a site again when the user comes back, with Memory on', async () => {
    const { site, deps } = setup(new FakeModelRuntime([answer('Seven is odd.')]));
    await open(deps);
    await startModel();
    await ask('Is seven odd?');
    expect(byId('transcript').textContent).toContain('Seven is odd.');
    await moveTo(deps, site, 8);
    expect(byId('transcript').textContent).toBe('');
    await moveTo(deps, site, 7);
    expect(byId('transcript').textContent).toContain('Is seven odd?');
    expect(byId('transcript').textContent).toContain('Seven is odd.');
    expect(byId('chat-empty').hidden).toBe(true);
  });

  it('says that chats are not kept when Memory is off', async () => {
    const { site, deps } = setup(new FakeModelRuntime([answer('ok')]));
    deps.settings = { ...DEFAULT_SETTINGS, memory: false };
    await open(deps);
    await moveTo(deps, site, 8);
    expect(text('chat-empty')).toBe('Memory is off, so chats are not kept when you switch sites.');
    expect(byId('chat-empty').hidden).toBe(false);
  });

  it('keeps the chat while the tab moves inside one site', async () => {
    const { site, deps } = setup(new FakeModelRuntime([answer('Seven is odd.')]));
    await open(deps);
    await startModel();
    await ask('Is seven odd?');
    site.tabs.set(7, { title: 'Two', url: `${ORIGIN}/two` });
    site.emit({ kind: 'tab-updated', tabId: 7, status: 'complete', url: `${ORIGIN}/two` });
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    expect(byId('transcript').textContent).toContain('Seven is odd.');
  });

  it('shows the open-a-page text when no page is open', async () => {
    const deps = fakeDeps([]);
    deps.targetTab = () => Promise.resolve(undefined);
    await open(deps);
    expect(text('chat-empty')).toBe(
      'Open a web page, then ask about it. You can still chat without a page.',
    );
  });
});
