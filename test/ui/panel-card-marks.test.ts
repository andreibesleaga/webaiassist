// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The card's site row, access badge, main button and tool marks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageInfo } from '../../src/adapters/messaging-tool-bridge';
import { byId, loadPage } from './dom';
import { fakeDeps, ORIGIN } from './panel-fakes';
import { fakeClock, open, text } from './site-helpers';

const two = [
  { name: 'add', description: 'Adds two numbers.', annotations: { readOnlyHint: false } },
  { name: 'echo', description: 'Returns the text.', annotations: { readOnlyHint: true } },
];
const page = (origin: string, tools: PageInfo['tools']): PageInfo => ({
  origin,
  linkset: false,
  tools,
});

describe('the card of a page', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the site, the access badge, and makes Read this page the main button only without tools', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, two);
    await open(deps);
    expect(text('page-card-title')).toBe('node.example');
    expect(text('access-badge')).toBe('Allowed');
    expect(byId('access-badge').className).toBe('badge ok');
    expect(byId('read-page').classList.contains('primary')).toBe(false);
    const none = fakeDeps([], {});
    none.bridge.pageResult = page(ORIGIN, []);
    await open(none);
    expect(byId('read-page').classList.contains('primary')).toBe(true);
  });

  it('marks a tool with no hint "not marked" as well, and a page-content tool "page content"', async () => {
    const deps = fakeDeps([], {});
    deps.bridge.pageResult = page(ORIGIN, [
      { name: 'mystery', description: 'Does a thing.' },
      {
        name: 'feed',
        description: 'Lists posts.',
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
    ]);
    await open(deps);
    const marks = (name: string) =>
      [...document.querySelectorAll('#tools-rows li')]
        .find((li) => li.querySelector('code')?.textContent === name)
        ?.querySelectorAll('.mark');
    expect([...(marks('mystery') ?? [])].map((m) => m.textContent)).toEqual([
      'changes',
      'not marked',
    ]);
    expect([...(marks('feed') ?? [])].map((m) => m.textContent)).toEqual(['reads', 'page content']);
  });
});
