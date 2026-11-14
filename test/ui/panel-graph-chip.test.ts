// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answer } from '../helpers';
import { byId, click, loadPage } from './dom';
import { fakeDeps, FakeSite } from './panel-fakes';
import { fakeClock, fixture, found, nodeOutcomes, open } from './site-helpers';
import { AGSC_PROFILE } from '../../src/core/site-linkset';
import type { Outcomes } from '../../src/core/site-facts';

const chip = (): HTMLElement | null => byId('site-chips').querySelector('[data-chip="graph"]');
const patterns = (): Outcomes => ({
  linkset: found(
    fixture('../graph/pat-linkset.json').replaceAll(
      'https://patterns.agenticsystemcore.com',
      'https://node.example',
    ),
    `application/linkset+json; profile="${AGSC_PROFILE}"`,
  ),
});

function withSite(outcomes: Outcomes, opened: [number, string][] = []) {
  const site = new FakeSite();
  site.outcomes = outcomes;
  const deps = fakeDeps([answer('ok')], { site });
  return {
    deps: { ...deps, openGraph: (tabId: number, origin: string) => opened.push([tabId, origin]) },
  };
}

describe('the "Graph: N items" chip', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('is built in code and not part of the page file', () => {
    expect(chip()).toBeNull();
    expect(document.getElementById('open-graph')).toBeNull();
  });

  it('says how many items the node’s counts add up to, in a button', async () => {
    await open(withSite(nodeOutcomes()).deps);
    const button = byId('open-graph');
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent).toBe('Graph: 17 items');
    expect(button.title).toContain('clusters 3, concepts 13, procedures 1');
    expect(button.title).toContain('has not checked');
  });

  it('adds the counts of the Patterns node: 70 items', async () => {
    await open(withSite(patterns()).deps);
    expect(byId('open-graph').textContent).toBe('Graph: 70 items');
  });

  it('is absent without counts, on a site that is not a node, and before the site is read', async () => {
    const bare = nodeOutcomes();
    const text = (bare.linkset as { text: string }).text.replace(/"agsc-counts":\[[^\]]*\],/, '');
    bare.linkset = found(text, (bare.linkset as { contentType: string }).contentType);
    await open(withSite(bare).deps);
    expect(chip()).toBeNull();
  });

  it('is absent when the site is not allowed yet', async () => {
    await open(withSite({}).deps);
    expect(chip()).toBeNull();
  });

  it('opens the explorer for this tab and this site when pressed, and not before', async () => {
    const opened: [number, string][] = [];
    await open(withSite(nodeOutcomes(), opened).deps);
    expect(opened).toEqual([]);
    click('open-graph');
    expect(opened).toHaveLength(1);
    expect(opened[0]?.[1]).toBe('https://node.example');
  });

  it('shows the chip text as text, whatever the counts say', async () => {
    const odd = nodeOutcomes();
    const text = (odd.linkset as { text: string }).text.replace(
      '"clusters=3"',
      '"<img src=x onerror=alert(1)>=3"',
    );
    odd.linkset = found(text, (odd.linkset as { contentType: string }).contentType);
    await open(withSite(odd).deps);
    expect(byId('site-chips').querySelector('img')).toBeNull();
    expect(byId('open-graph').textContent).toBe('Graph: 14 items');
  });
});
