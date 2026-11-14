// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { explorerQuery, parseExplorerQuery } from '../../src/ui/explorer-url';

describe('the explorer page address', () => {
  it('carries the tab, the origin and the node address, and reads them back', () => {
    const target = { tabId: 12, origin: 'https://agenticsystemcore.com' };
    const query = explorerQuery(target);
    expect(new URLSearchParams(query).get('src')).toBe('https://agenticsystemcore.com/');
    expect(parseExplorerQuery(`?${query}`)).toEqual(target);
  });

  it.each([
    '',
    '?tabid=1',
    '?origin=https://a.example',
    '?tabid=x&origin=https://a.example',
    '?tabid=-1&origin=https://a.example',
    '?tabid=1.5&origin=https://a.example',
    '?tabid=1&origin=ftp://a.example',
    '?tabid=1&origin=https://a.example/path',
    '?tabid=1&origin=javascript:alert(1)',
  ])('refuses %s', (search) => {
    expect(parseExplorerQuery(search)).toBeUndefined();
  });
});
