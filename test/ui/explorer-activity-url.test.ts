// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { activityQuery, wantsActivity, parseExplorerQuery } from '../../src/ui/explorer-url';

describe('the address of the Activity view', () => {
  it('names the view, and the tab and site only when the panel has them', () => {
    expect(activityQuery()).toBe('view=activity');
    const withTab = activityQuery({ tabId: 7, origin: 'https://a.example' });
    expect(withTab).toBe('view=activity&tabid=7&origin=https%3A%2F%2Fa.example');
    expect(parseExplorerQuery(`?${withTab}`)).toEqual({ tabId: 7, origin: 'https://a.example' });
  });

  it('is recognised, and only for exactly that value', () => {
    expect(wantsActivity('?view=activity')).toBe(true);
    expect(wantsActivity('?view=activity&tabid=1&origin=https://a.example')).toBe(true);
    expect(wantsActivity('?view=graph')).toBe(false);
    expect(wantsActivity('?tabid=1&origin=https://a.example')).toBe(false);
    expect(wantsActivity('')).toBe(false);
  });
});
