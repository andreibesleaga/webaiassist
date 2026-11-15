// SPDX-License-Identifier: Apache-2.0
// The number on the toolbar icon: how many tools the open page offers, for a site the user
// allowed only. Fakes stand for the browser; nothing here asks for a permission.
import { describe, expect, it } from 'vitest';
import { badgeText, refreshBadge, type BadgeDeps } from '../../src/adapters/tool-badge';
import type { ToolInfo } from '../../src/core/types';

const tool = (name: string, extra: Partial<ToolInfo> = {}): ToolInfo => ({
  name,
  description: `Does ${name}.`,
  ...extra,
});

function fake(allowedOrigins: string[], tools: ToolInfo[]) {
  const set: { tabId: number; text: string }[] = [];
  const asked: string[] = [];
  const listed: number[] = [];
  const deps: BadgeDeps = {
    allowed: (origin) => {
      asked.push(origin);
      return Promise.resolve(allowedOrigins.includes(origin));
    },
    list: (tabId) => {
      listed.push(tabId);
      return Promise.resolve({ origin: 'https://a.example', tools });
    },
    set: (tabId, text) => {
      set.push({ tabId, text });
      return Promise.resolve();
    },
  };
  return { deps, set, asked, listed };
}

describe('badgeText', () => {
  it('is empty for none, the number up to 99, and 99+ above', () => {
    expect([0, 1, 12, 99, 100, 5000].map(badgeText)).toEqual(['', '1', '12', '99', '99+', '99+']);
  });
});

describe('refreshBadge', () => {
  it('writes the number of tools for an allowed site', async () => {
    const f = fake(['https://a.example'], [tool('a'), tool('b')]);
    await refreshBadge(f.deps, { id: 3, url: 'https://a.example/page?x=1' });
    expect(f.set).toEqual([{ tabId: 3, text: '2' }]);
  });

  it('does not count a tool marked for developers or a tool the model may not see', async () => {
    const f = fake(
      ['https://a.example'],
      [tool('a'), tool('dev', { annotations: { debugging: true } }), tool('bad\nname')],
    );
    await refreshBadge(f.deps, { id: 3, url: 'https://a.example/' });
    expect(f.set).toEqual([{ tabId: 3, text: '1' }]);
  });

  it('clears the badge and does not list the tools of a site that is not allowed', async () => {
    const f = fake([], [tool('a')]);
    await refreshBadge(f.deps, { id: 3, url: 'https://a.example/' });
    expect(f.set).toEqual([{ tabId: 3, text: '' }]);
    expect(f.listed).toEqual([]);
  });

  it('clears the badge for a page that is not http or https, or has no address', async () => {
    const f = fake(['chrome://extensions'], [tool('a')]);
    await refreshBadge(f.deps, { id: 1, url: 'chrome://extensions/' });
    await refreshBadge(f.deps, { id: 2 });
    await refreshBadge(f.deps, { id: 4, url: 'not a url' });
    expect(f.set.map((s) => s.text)).toEqual(['', '', '']);
    expect(f.asked).toEqual([]);
  });

  it('clears the badge when the listing fails, and never throws', async () => {
    const f = fake(['https://a.example'], []);
    const failing: BadgeDeps = { ...f.deps, list: () => Promise.reject(new Error('no tab')) };
    await expect(
      refreshBadge(failing, { id: 9, url: 'https://a.example/' }),
    ).resolves.toBeUndefined();
    expect(f.set).toEqual([{ tabId: 9, text: '' }]);
  });

  it('asks only about the origin, never the whole address', async () => {
    const f = fake(['https://a.example'], []);
    await refreshBadge(f.deps, { id: 3, url: 'https://a.example/secret/path?token=1#frag' });
    expect(f.asked).toEqual(['https://a.example']);
  });
});
