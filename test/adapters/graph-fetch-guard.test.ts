// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { decide, refusalText, type GuardState } from '../../src/adapters/graph-fetch-guard';

const TAB = 'https://node.example';
const PEER = 'https://peer.example';
const state = (approved: string[] = []): GuardState => ({
  tabOrigin: TAB,
  approved: new Set(approved),
});

describe('decide: the node’s own files go through the tab', () => {
  it.each([
    ['/.well-known/knowledge-linkset', 'linkset'],
    ['/graph.jsonld', 'graph-jsonld'],
    ['/chunks.jsonl', 'chunks'],
  ])('%s', (path, spec) => {
    expect(decide(`${TAB}${path}`, state())).toEqual({ kind: 'tab', path, spec });
  });

  it('reads the same files from a tab origin written in capitals', () => {
    expect(decide('https://NODE.example/graph.jsonld', state()).kind).toBe('tab');
  });
});

describe('decide: refusals', () => {
  const cases: [string, string, string[]][] = [
    ['another path of the tab origin', `${TAB}/private/account`, []],
    ['the N-Quads file (not for the explorer)', `${TAB}/graph.nq`, []],
    ['a query string', `${TAB}/graph.jsonld?x=1`, []],
    ['a fragment', `${TAB}/graph.jsonld#x`, []],
    ['user info', 'https://u:p@node.example/graph.jsonld', []],
    ['a path that climbs', `${TAB}/a/../graph.jsonld/..`, []],
    ['an origin nobody approved', `${PEER}/graph.jsonld`, []],
    ['an approved peer but another path', `${PEER}/ns/agsc.ttl`, [PEER]],
    ['a protocol-relative address', '//evil.example/graph.jsonld', []],
    ['a scheme that is not http', 'javascript:alert(1)', []],
    ['not an address', 'graph.jsonld', []],
    ['http for a peer', 'http://peer.example/graph.jsonld', [PEER]],
    ['an IP address that was “approved”', 'https://1.2.3.4/graph.jsonld', ['https://1.2.3.4']],
    ['port 8443 on a peer', 'https://peer.example:8443/graph.jsonld', [PEER]],
  ];
  it.each(cases)('%s', (_name, url, approved) => {
    expect(decide(url, state(approved)).kind).toBe('refuse');
  });

  it('gives a plain reason for each refusal', () => {
    const why = decide(`${PEER}/graph.jsonld`, state());
    expect(why.kind === 'refuse' && refusalText(why.why)).toMatch(/not ticked/);
    const other = decide(`${TAB}/secret`, state());
    expect(other.kind === 'refuse' && refusalText(other.why)).toMatch(/fixed list/);
  });
});

describe('decide: peers', () => {
  it('lets an approved https origin through for the three fixed paths only', () => {
    const paths = {
      '/.well-known/knowledge-linkset': 'linkset',
      '/graph.jsonld': 'graph-jsonld',
      '/chunks.jsonl': 'chunks',
    };
    for (const [path, spec] of Object.entries(paths)) {
      expect(decide(`${PEER}${path}`, state([PEER]))).toEqual({
        kind: 'peer',
        url: `${PEER}${path}`,
        spec,
      });
    }
  });

  it('normalises case and a trailing dot before comparing with the approved origins', () => {
    const decision = decide('https://PEER.example./graph.jsonld', state([PEER]));
    expect(decision).toEqual({
      kind: 'peer',
      url: 'https://peer.example./graph.jsonld',
      spec: 'graph-jsonld',
    });
  });
});
