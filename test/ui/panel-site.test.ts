// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import { answer } from '../helpers';
import { byId, click, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, FakeSite, ORIGIN } from './panel-fakes';
import {
  afterQuiet,
  chips,
  fakeClock,
  flush,
  found,
  nodeOutcomes,
  open,
  text,
} from './site-helpers';

function withSite(replies: string[] = [answer('ok')]) {
  const site = new FakeSite();
  const deps = fakeDeps(replies, { site });
  return { site, deps };
}

describe('the card shows what the site publishes', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a chip for each file found, marked as published by the site, with the path', async () => {
    const { site, deps } = withSite();
    site.outcomes = nodeOutcomes();
    await open(deps);
    expect(chips()).toEqual([
      'knowledge links',
      'llms.txt',
      'security.txt',
      'AI policy',
      'Graph: 17 items',
    ]);
    const llms = byId('site-chips').querySelector('[data-chip="llms"]');
    expect(llms?.getAttribute('title')).toContain('Published by the site');
    expect(llms?.getAttribute('title')).toContain('/llms.txt');
  });

  it('shows the node badge and short labelled facts for a node with a valid knowledge link set', async () => {
    const { site, deps } = withSite();
    site.outcomes = nodeOutcomes();
    await open(deps);
    expect(byId('node-badge').hidden).toBe(false);
    expect(byId('node-badge').textContent).toBe('Says it is an AgenticSystemCore node');
    expect(byId('node-badge').getAttribute('aria-label')).toMatch(/says it is/);
    const facts = byId('site-facts-list').textContent ?? '';
    expect(facts).toContain('specification 1.1.0');
    expect(facts).toContain('Site guide: AgenticSystemCore (14 links in 3 sections)');
    expect(facts).toContain('Security contact');
    expect(facts).toContain('not checked');
    expect(text('site-ai')).toContain('AI policy: the site allows AI input.');
    expect(text('site-ai')).toContain(
      'Training: the site reserves its rights. This is not a ban on reading.',
    );
  });

  it('keeps the badge off when the linkset is another site’s, whatever the page link says', async () => {
    const bridge = new FakePanelBridge([], true);
    const site = new FakeSite();
    const deps = fakeDeps([], { bridge, site });
    const other = nodeOutcomes();
    other.linkset = found(
      (nodeOutcomes().linkset as { text: string }).text.replace(
        '"anchor":"https://node.example/"',
        '"anchor":"https://elsewhere.test/"',
      ),
      (nodeOutcomes().linkset as { contentType: string }).contentType,
    );
    site.outcomes = other;
    await open(deps);
    expect(byId('node-badge').hidden).toBe(true);
    expect(chips()).not.toContain('knowledge links');
  });

  it('shows no chip and no error for files that are missing or broken', async () => {
    const { site, deps } = withSite();
    site.outcomes = {
      llms: { state: 'not-published' },
      linkset: { state: 'not-usable', why: 'type' },
      security: { state: 'unavailable', why: 'timeout' },
    };
    await open(deps);
    expect(chips()).toEqual([]);
    expect(byId('error-banner').hidden).toBe(true);
  });

  it('reads nothing from a site that is not allowed yet', async () => {
    const bridge = new FakePanelBridge();
    bridge.pageResult = new PageError('not allowed', undefined, 'denied');
    const site = new FakeSite();
    await open(fakeDeps([], { bridge, site }));
    expect(site.fileCalls).toEqual([]);
    expect(site.tabCalls).toEqual([]);
    expect(text('page-status')).toBe('This page — not allowed yet');
    expect(chips()).toEqual([]);
  });

  it('reads nothing from a page the extension cannot run on', async () => {
    const bridge = new FakePanelBridge();
    bridge.pageResult = new PageError('chrome://', undefined, 'restricted');
    const site = new FakeSite();
    await open(fakeDeps([], { bridge, site }));
    expect(site.fileCalls).toEqual([]);
  });

  it('shows "Looking for what this site publishes" while the files are read', async () => {
    const { site, deps } = withSite();
    let release: (() => void) | undefined;
    site.files = () =>
      new Promise((resolve) => {
        release = () => resolve({});
      });
    await open(deps);
    expect(byId('site-looking').hidden).toBe(false);
    release?.();
    await flush();
    expect(byId('site-looking').hidden).toBe(true);
  });

  it('keeps showing "Looking" when only the title changes while the files are read', async () => {
    const { site, deps } = withSite();
    let release: (() => void) | undefined;
    site.files = () =>
      new Promise((resolve) => {
        release = () => resolve(nodeOutcomes());
      });
    await open(deps);
    site.tabs.set(7, { title: 'Shop, 3 items', url: `${ORIGIN}/shop` });
    site.emit({ kind: 'tab-updated', tabId: 7, title: 'Shop, 3 items' });
    await afterQuiet();
    expect(byId('site-looking').hidden).toBe(false);
    expect(chips()).toEqual([]);
    release?.();
    await flush();
    expect(byId('site-looking').hidden).toBe(true);
    expect(chips()).toContain('llms.txt');
  });

  it('keeps showing "Looking" when the title changes before the site reading has begun', async () => {
    const { site, deps } = withSite();
    let release: (() => void) | undefined;
    const tab = site.tab.bind(site);
    site.tab = (tabId: number) =>
      release === undefined
        ? new Promise((resolve) => {
            release = () => void tab(tabId).then(resolve);
          })
        : tab(tabId);
    await open(deps);
    expect(byId('site-looking').hidden).toBe(false);
    site.emit({ kind: 'tab-updated', tabId: 7, title: 'Shop' });
    await afterQuiet();
    expect(byId('site-looking').hidden).toBe(false);
    release?.();
    await flush();
    expect(byId('site-looking').hidden).toBe(true);
  });

  it('reads the files once per tab and site, however often the page is read again', async () => {
    const { site, deps } = withSite();
    site.outcomes = nodeOutcomes();
    const panel = await open(deps);
    await panel.refresh();
    await panel.refresh();
    site.emit({ kind: 'tab-updated', tabId: 7, url: `${ORIGIN}/other` });
    await afterQuiet();
    expect(site.fileCalls).toHaveLength(1);
    expect(site.fileCalls[0]).toEqual({ tabId: 7, origin: ORIGIN });
  });

  it('reads the files again after the site is forgotten', async () => {
    const { site, deps } = withSite();
    site.outcomes = nodeOutcomes();
    await open(deps);
    click('forget');
    await flush();
    expect(site.fileCalls).toHaveLength(2);
    expect(deps.forgotten).toEqual([ORIGIN]);
  });

  it('reads the files again when access changes (a grant)', async () => {
    const { site, deps } = withSite();
    await open(deps);
    site.emit({ kind: 'access-changed' });
    await afterQuiet();
    expect(site.fileCalls).toHaveLength(2);
  });
});
