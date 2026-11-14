// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { GRAPH_FILES } from '../../src/core/graph-files';
import { HOPS } from '../../src/protocol/messages';
import { parseMessage } from '../../src/protocol/validate';

const answer = {
  type: 'site/graph-file',
  id: 'graph-jsonld',
  origin: 'https://node.example',
  status: 200,
  contentType: 'application/ld+json',
  link: '',
  text: '{"@graph":[]}',
  cut: false,
};

describe('the graph-file message', () => {
  it('is carried on the site hop only', () => {
    expect(HOPS.site).toContain('site/graph-file');
    for (const hop of ['page', 'content', 'panel', 'offscreen'] as const) {
      expect(parseMessage(answer, hop).ok).toBe(false);
    }
  });

  it('accepts each id of the graph list and nothing else', () => {
    for (const spec of GRAPH_FILES) {
      expect(parseMessage({ ...answer, id: spec.id }, 'site').ok).toBe(true);
    }
    for (const id of ['llms', 'linkset', 'graph.jsonld', '']) {
      expect(parseMessage({ ...answer, id }, 'site').ok, id).toBe(false);
    }
  });

  it('allows text up to 4 MiB, more than a site file may carry', () => {
    const big = 'x'.repeat(4 * 1024 * 1024);
    expect(parseMessage({ ...answer, text: big }, 'site').ok).toBe(true);
    expect(parseMessage({ ...answer, text: `${big}x` }, 'site').ok).toBe(false);
    expect(
      parseMessage({ ...answer, type: 'site/file', text: 'x'.repeat(512_001) }, 'site').ok,
    ).toBe(false);
  });

  it('refuses an extra field, a missing field and a status out of range', () => {
    expect(parseMessage({ ...answer, extra: 1 }, 'site').ok).toBe(false);
    const { cut: _cut, ...partial } = answer;
    expect(parseMessage(partial, 'site').ok).toBe(false);
    expect(parseMessage({ ...answer, status: 600 }, 'site').ok).toBe(false);
  });
});
