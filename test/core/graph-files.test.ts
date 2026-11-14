// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  GRAPH_FILES,
  STANDARD_GRAPH_PATH,
  graphItemCount,
  graphSpecOf,
  parseCounts,
} from '../../src/core/graph-files';
import { checkReply, type SiteFileReply } from '../../src/core/site-files';

const MIB = 1024 * 1024;

const reply = (change: Partial<SiteFileReply> = {}): SiteFileReply => ({
  status: 200,
  contentType: 'application/ld+json; charset=utf-8',
  link: '',
  text: '{}',
  cut: false,
  ...change,
});

describe('the fixed list of graph files', () => {
  it('has four files, each path once, with the stated caps', () => {
    const caps = Object.fromEntries(GRAPH_FILES.map((spec) => [spec.id, spec.maxBytes]));
    expect(caps).toEqual({
      'graph-jsonld': 2 * MIB,
      'graph-nq': 4 * MIB,
      chunks: 2 * MIB,
      ontology: 1 * MIB,
    });
    const paths = GRAPH_FILES.map((spec) => spec.path);
    expect(new Set(paths).size).toBe(4);
    for (const path of paths) expect(path).toMatch(/^\/[A-Za-z0-9._/-]+$/);
  });

  it('finds a file by id and fails loudly for an unknown one', () => {
    expect(graphSpecOf('graph-jsonld').path).toBe(STANDARD_GRAPH_PATH);
    expect(() => graphSpecOf('nothing' as never)).toThrow(/unknown/);
  });

  it('drops a cut file whole and refuses a page that is not data', () => {
    for (const spec of GRAPH_FILES) {
      const type = spec.accept[0] ?? '';
      expect(checkReply(spec, reply({ contentType: type, cut: true }))).toEqual({
        state: 'not-usable',
        why: 'size',
      });
      expect(checkReply(spec, reply({ contentType: 'text/html' }))).toEqual({
        state: 'not-usable',
        why: 'type',
      });
    }
  });
});

describe('parseCounts and graphItemCount', () => {
  it('reads name=number strings and sums them', () => {
    const counts = parseCounts(['clusters=3', 'concepts=13', 'episodes=0', 'procedures=1']);
    expect(counts).toEqual({ clusters: 3, concepts: 13, episodes: 0, procedures: 1 });
    expect(graphItemCount(counts)).toBe(17);
  });

  it('keeps the Patterns node at 70 items', () => {
    expect(graphItemCount(parseCounts(['clusters=20', 'concepts=50']))).toBe(70);
  });

  it('ignores anything that is not a plain count', () => {
    const odd = ['a=-1', 'b=1.5', 'c=x', 'd=1000000000', '=4', 'e', 'f=007', 7, null];
    expect(parseCounts(odd as never)).toEqual({ f: 7 });
    expect(parseCounts('clusters=3' as never)).toEqual({});
  });

  it('takes at most 20 entries', () => {
    const many = Array.from({ length: 25 }, (_, index) => `k${index}=1`);
    expect(Object.keys(parseCounts(many))).toHaveLength(20);
  });

  it('says nothing for a node with no counts', () => {
    expect(graphItemCount(undefined)).toBeUndefined();
    expect(graphItemCount({})).toBeUndefined();
  });
});
