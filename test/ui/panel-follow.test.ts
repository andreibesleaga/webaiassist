// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageInfo } from '../../src/adapters/messaging-tool-bridge';
import { gather, LONGEST_WAIT_MS, QUIET_MS } from '../../src/ui/panel-follow';
import { AGSC_TOOLS } from '../helpers';
import { loadPage } from './dom';
import { fakeDeps, FakeSite, ORIGIN } from './panel-fakes';
import { afterQuiet, fakeClock, flush, nodeOutcomes, open, text } from './site-helpers';

const OTHER = 'https://other.example';
const two = [
  {
    name: 'add',
    description: 'Adds two numbers. More text.',
    annotations: { readOnlyHint: false },
  },
  { name: 'echo', description: 'Returns the text.', annotations: { readOnlyHint: true } },
];
const page = (origin: string, tools: PageInfo['tools']): PageInfo => ({
  origin,
  linkset: false,
  tools,
});

describe('the card follows the browser', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  function setup() {
    const site = new FakeSite();
    const deps = fakeDeps([], { site });
    deps.bridge.pageByTab.set(7, page(ORIGIN, two));
    deps.bridge.pageByTab.set(8, page(OTHER, []));
    site.tabs.set(7, { title: 'Shop', url: `${ORIGIN}/shop` });
    site.tabs.set(8, { title: 'Docs', url: `${OTHER}/docs` });
    return { site, deps };
  }

  it('switches to another tab by itself, after a moment', async () => {
    const { site, deps } = setup();
    await open(deps);
    expect(text('page-status')).toBe('node.example — 2 WebMCP tools');
    deps.currentTab = 8;
    site.emit({ kind: 'tab-activated' });
    expect(text('page-status')).toBe('node.example — 2 WebMCP tools');
    await afterQuiet();
    expect(text('page-status')).toContain('other.example');
    expect(text('page-status')).toContain('no WebMCP tools');
    expect(text('page-title')).toBe('Docs');
  });

  it('follows the focused window the same way', async () => {
    const { site, deps } = setup();
    await open(deps);
    deps.currentTab = 8;
    site.emit({ kind: 'window-focus' });
    await afterQuiet();
    expect(text('page-status')).toContain('other.example');
  });

  it('shows only the name and Allow for a tab on a site that is not allowed, and reads nothing there', async () => {
    const { site, deps } = setup();
    deps.bridge.pageByTab.set(
      9,
      new (await import('../../src/adapters/messaging-tool-bridge')).PageError(
        'no',
        undefined,
        'denied',
      ),
    );
    await open(deps);
    const filesBefore = site.fileCalls.length;
    const tabsBefore = site.tabCalls.length;
    deps.currentTab = 9;
    site.emit({ kind: 'tab-activated' });
    await afterQuiet();
    expect(text('page-status')).toBe('This page — not allowed yet');
    expect(document.getElementById('allow-site')?.hidden).toBe(false);
    expect(site.fileCalls).toHaveLength(filesBefore);
    expect(site.tabCalls).toHaveLength(tabsBefore);
    expect(document.getElementById('tools-toggle')?.hidden).toBe(true);
  });

  it('refreshes when the page finishes loading or its address changes in place', async () => {
    const { site, deps } = setup();
    await open(deps);
    const before = deps.bridge.pageCalls;
    site.emit({ kind: 'tab-updated', tabId: 7, status: 'complete' });
    await afterQuiet();
    expect(deps.bridge.pageCalls).toBe(before + 1);
    site.emit({ kind: 'tab-updated', tabId: 7, url: `${ORIGIN}/cart` });
    await afterQuiet();
    expect(deps.bridge.pageCalls).toBe(before + 2);
  });

  it('shows "Looking at {host}…" while the new page is listed', async () => {
    const { site, deps } = setup();
    await open(deps);
    let release: (() => void) | undefined;
    const original = deps.bridge.page.bind(deps.bridge);
    deps.bridge.page = (tabId?: number) =>
      new Promise((resolve) => {
        release = () => void original(tabId).then(resolve);
      });
    site.emit({ kind: 'tab-updated', tabId: 7, status: 'complete' });
    await afterQuiet();
    expect(text('page-status')).toBe('Looking at node.example…');
    release?.();
    await flush();
    expect(text('page-status')).toBe('node.example — 2 WebMCP tools');
  });

  it('only redraws the title when only the title changes: the tools are not listed again', async () => {
    const { site, deps } = setup();
    await open(deps);
    const before = deps.bridge.pageCalls;
    site.tabs.set(7, { title: 'Shop, 3 items', url: `${ORIGIN}/shop` });
    site.emit({ kind: 'tab-updated', tabId: 7, title: 'Shop, 3 items' });
    await afterQuiet();
    expect(text('page-title')).toBe('Shop, 3 items');
    expect(deps.bridge.pageCalls).toBe(before);
  });

  it('ignores events of tabs the panel does not work on, and a loading status alone', async () => {
    const { site, deps } = setup();
    await open(deps);
    const before = deps.bridge.pageCalls;
    site.emit({ kind: 'tab-updated', tabId: 99, status: 'complete' });
    site.emit({ kind: 'tab-updated', tabId: 7, status: 'loading' });
    await afterQuiet();
    expect(deps.bridge.pageCalls).toBe(before);
  });

  it('raises the count when the page registers another tool', async () => {
    const { deps } = setup();
    await open(deps);
    deps.bridge.pageByTab.set(
      7,
      page(ORIGIN, [...two, { name: 'new', description: 'A third tool.' }]),
    );
    deps.bridge.replaceTools(7, [...two]);
    await afterQuiet();
    expect(text('page-status')).toBe('node.example — 3 WebMCP tools');
  });

  it('refreshes once for a thousand events in a second, and reads no file twice', async () => {
    const { site, deps } = setup();
    site.outcomes = nodeOutcomes();
    await open(deps);
    const pages = deps.bridge.pageCalls;
    for (let i = 0; i < 1000; i += 1) {
      site.emit({ kind: 'tab-updated', tabId: 7, status: 'complete', url: `${ORIGIN}/p${i}` });
      deps.bridge.replaceTools(7, [...two]);
    }
    await afterQuiet();
    expect(deps.bridge.pageCalls).toBe(pages + 1);
    expect(site.fileCalls).toHaveLength(1);
  });

  it('does not let a slow answer for an older tab overwrite the newer one', async () => {
    const { site, deps } = setup();
    await open(deps);
    const slow = new Promise<PageInfo>((resolve) => {
      setTimeout(() => resolve(page(ORIGIN, two)), 5000);
    });
    const original = deps.bridge.page.bind(deps.bridge);
    deps.bridge.page = (tabId?: number) => (tabId === 7 ? slow : original(tabId));
    site.emit({ kind: 'tab-activated' });
    await afterQuiet();
    deps.currentTab = 8;
    site.emit({ kind: 'tab-activated' });
    await afterQuiet();
    await vi.advanceTimersByTimeAsync(5000);
    await flush();
    expect(text('page-status')).toContain('other.example');
  });
});

describe('gather', () => {
  beforeEach(() => fakeClock());
  afterEach(() => vi.useRealTimers());

  it('calls once, a quiet time after the last call', () => {
    const run = vi.fn();
    const request = gather(run);
    request('page');
    vi.advanceTimersByTime(QUIET_MS - 1);
    request('title');
    vi.advanceTimersByTime(QUIET_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('page');
  });

  it('asks for a title only when nothing more than the title changed', () => {
    const run = vi.fn();
    const request = gather(run);
    request('title');
    request('title');
    vi.advanceTimersByTime(QUIET_MS);
    expect(run).toHaveBeenCalledWith('title');
  });

  it('still fires for a page that never stops changing', () => {
    const run = vi.fn();
    const request = gather(run);
    for (let elapsed = 0; elapsed <= LONGEST_WAIT_MS; elapsed += 100) {
      request('page');
      vi.advanceTimersByTime(100);
    }
    expect(run).toHaveBeenCalled();
  });
});

describe('the tools of the page in the card', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  const rows = () =>
    [...(document.getElementById('tools-rows')?.querySelectorAll('li') ?? [])].map(
      (li) => li.textContent ?? '',
    );

  it('lists name, one line of what it does, and reads or changes', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, two);
    await open(deps);
    // Name, then the marks (a "!" in front of "changes"), then what the tool does.
    expect(rows()).toEqual(['echoreadsReturns the text.', 'add!changesAdds two numbers.']);
    expect(text('tools-toggle')).toBe('Tools (2): 1 read, 1 may change something');
  });

  it('counts a tool with no hint as one that changes something, and says the page did not mark it', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, [{ name: 'mystery', description: 'Does a thing.' }]);
    await open(deps);
    const mark = document.querySelector('#tools-rows .mark');
    expect(mark?.textContent).toBe('changes');
    expect(mark?.getAttribute('title')).toMatch(/does not say whether/);
  });

  it('shows the page’s words as text only, with hidden characters made visible', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, [
      {
        name: 'xy',
        description: '<img src=x onerror=alert(1)> read​ this',
        annotations: { readOnlyHint: true },
      },
    ]);
    await open(deps);
    expect(document.querySelector('#tools-rows img')).toBeNull();
    expect(rows()[0]).toContain('xy');
    expect(rows()[0]).toContain('<img src=x onerror=alert(1)> read[U+200B] this');
  });

  it('opens and closes the list from the Tools button', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, AGSC_TOOLS);
    await open(deps);
    const toggle = document.getElementById('tools-toggle') as HTMLButtonElement;
    expect(document.getElementById('tools-list')?.hidden).toBe(true);
    toggle.click();
    expect(document.getElementById('tools-list')?.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    expect(document.getElementById('tools-list')?.hidden).toBe(true);
  });

  it('hides the Tools button for a page with no tools', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, []);
    await open(deps);
    expect(document.getElementById('tools-toggle')?.hidden).toBe(true);
  });
});
