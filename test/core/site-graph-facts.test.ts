// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSiteFacts } from '../../src/core/site-facts';
import { AGSC_PROFILE, parseLinkset } from '../../src/core/site-linkset';

const fixture = (name: string): string => readFileSync(`fixtures/graph/${name}`, 'utf8');
const TYPE = `application/linkset+json; profile="${AGSC_PROFILE}"`;

const factsOf = (name: string, origin: string, profile = true) =>
  buildSiteFacts({
    origin,
    outcomes: {
      linkset: {
        state: 'found',
        text: fixture(name),
        cut: false,
        link: '',
        contentType: profile ? TYPE : 'application/linkset+json',
      },
    },
    pagePath: '/',
    nowMs: Date.parse('2026-11-14T00:00:00Z'),
  });

describe('graph counts of a node', () => {
  it('main node: 3 clusters, 13 concepts, 1 procedure are 17 items', () => {
    const facts = factsOf('asc-linkset.json', 'https://agenticsystemcore.com');
    expect(facts.graphItems).toBe(17);
    expect(facts.node?.counts).toMatchObject({ clusters: 3, concepts: 13, procedures: 1 });
    expect(facts.node?.graphHref).toBe('https://agenticsystemcore.com/graph.jsonld');
  });

  it('Patterns node: 20 clusters and 50 concepts are 70 items', () => {
    const facts = factsOf('pat-linkset.json', 'https://patterns.agenticsystemcore.com');
    expect(facts.graphItems).toBe(70);
  });

  it('shows no count for a site that is not a node, or a node with no counts', () => {
    expect(factsOf('asc-linkset.json', 'https://agenticsystemcore.com', false).graphItems).toBe(
      undefined,
    );
    const bare = JSON.stringify({
      linkset: [
        { anchor: 'https://n.example/', describedby: [{ href: 'https://n.example/graph.jsonld' }] },
      ],
    });
    const result = parseLinkset(bare, 'https://n.example', true);
    expect(result.ok && result.linkset.counts).toBe(undefined);
  });

  it('keeps a graph address of another origin out of graphHref', () => {
    const text = JSON.stringify({
      linkset: [
        {
          anchor: 'https://n.example/',
          describedby: [{ href: 'https://elsewhere.example/g.jsonld', 'agsc-counts': ['a=1'] }],
        },
      ],
    });
    const result = parseLinkset(text, 'https://n.example', true);
    expect(result.ok && result.linkset.graphHref).toBe(undefined);
    expect(result.ok && result.linkset.counts).toEqual({ a: 1 });
  });
});
