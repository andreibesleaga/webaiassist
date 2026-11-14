// SPDX-License-Identifier: Apache-2.0
// Runs the copied data half of the site's explorer (third_party/agsc-explorer/graph-data.js, unchanged)
// over files recorded from the live nodes on 14 Nov 2026 (fixtures/graph/README.md): the picture the
// extension draws is the picture of the site. The vocabulary terms of a graph (owl and rdfs classes
// and properties) are not drawn, so the Patterns node comes out as one connected piece.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface Node {
  id: string;
  type: string;
}
interface Model {
  nodes: Node[];
  links: { source: string; target: string; rel: string }[];
  adj: Map<string, { id: string }[]>;
}
interface Api {
  parseGraph(doc: unknown, src: number, lang: string): { nodes: Node[]; links: unknown[] };
  merge(parts: unknown[], pairs: [number, number][]): Model;
  loadNetwork(
    address: string,
    options: Record<string, unknown>,
  ): Promise<{ nodes: { digest: string; error: string | null }[]; model: Model }>;
  safeHref(value: string): string | null;
}

function loadApi(): Api {
  const module = { exports: {} as unknown };
  runInNewContext(readFileSync('third_party/agsc-explorer/graph-data.js', 'utf8'), {
    module,
    URL,
    TextDecoder,
    AbortController,
    setTimeout,
    clearTimeout,
    Buffer,
  });
  return module.exports as Api;
}

const G = loadApi();
const json = (name: string): unknown =>
  JSON.parse(readFileSync(`fixtures/graph/${name}`, 'utf8')) as unknown;

function components(model: Model): number {
  const seen = new Set<string>();
  let count = 0;
  for (const node of model.nodes) {
    if (seen.has(node.id)) continue;
    count += 1;
    const stack = [node.id];
    while (stack.length > 0) {
      const id = stack.pop() ?? '';
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of model.adj.get(id) ?? []) stack.push(edge.id);
    }
  }
  return count;
}

const TERMS = /^(owl:|rdfs:|rdf:|http:\/\/www\.w3\.org\/)/;

describe('the picture of a recorded node', () => {
  it.each([['asc'], ['pat']])(
    '%s: one connected piece, no stray node, no vocabulary term',
    (name) => {
      const doc = json(`${name}-graph.jsonld`) as {
        '@graph': { '@id': string; '@type'?: unknown }[];
      };
      const model = G.merge([G.parseGraph(doc, 0, 'en')], []);
      expect(model.nodes.length).toBeGreaterThan(10);
      expect(components(model)).toBe(1);
      expect(
        model.nodes.filter((node) => node.type === 'Class' || node.type === 'Property'),
      ).toEqual([]);
      expect(model.nodes.filter((node) => model.adj.get(node.id)?.length === 0)).toEqual([]);
      const terms = doc['@graph'].filter((item) => {
        const types = ([] as unknown[]).concat(item['@type'] ?? []).map(String);
        return types.length > 0 && types.every((type) => TERMS.test(type));
      });
      for (const term of terms)
        expect(model.nodes.some((node) => node.id === term['@id'])).toBe(false);
    },
  );

  it('draws a node of each kind the site draws', () => {
    const model = G.merge([G.parseGraph(json('pat-graph.jsonld'), 0, 'en')], []);
    const types = new Set(model.nodes.map((node) => node.type));
    for (const type of ['Bundle', 'Cluster', 'Concept']) expect(types.has(type)).toBe(true);
  });

  it('leaves out a vocabulary term and keeps an item that names one', () => {
    const doc = {
      '@graph': [
        { '@id': 'https://n.example/', '@type': 'Bundle' },
        { '@id': 'https://n.example/ns#Thing', '@type': 'owl:Class' },
        { '@id': 'https://n.example/ns#p', '@type': ['rdf:Property', 'owl:ObjectProperty'] },
        { '@id': 'https://n.example/c/', '@type': 'Concept', inScheme: 'https://n.example/' },
      ],
    };
    const parsed = G.parseGraph(doc, 0, 'en');
    expect(parsed.nodes.map((node) => node.id)).toEqual([
      'https://n.example/',
      'https://n.example/c/',
    ]);
  });
});

describe('the data half reads a node the way the tab hands it over', () => {
  it('checks the declared digest of the graph it was given', async () => {
    const files = new Map<string, string>([
      [
        'https://agenticsystemcore.com/.well-known/knowledge-linkset',
        readFileSync('fixtures/graph/asc-linkset.json', 'utf8'),
      ],
      [
        'https://agenticsystemcore.com/graph.jsonld',
        readFileSync('fixtures/graph/asc-graph.jsonld', 'utf8'),
      ],
    ]);
    const net = await G.loadNetwork('https://agenticsystemcore.com/', {
      fetch: (url: string) => {
        const body = files.get(url);
        return Promise.resolve(
          body === undefined
            ? new Response('', { status: 404 })
            : new Response(body, { status: 200 }),
        );
      },
      sha256: (bytes: Uint8Array) =>
        Promise.resolve(createHash('sha256').update(bytes).digest('base64')),
      depth: 0,
      base: 'chrome-extension://x/explorer.html',
      lang: 'en',
    });
    expect(net.nodes[0]?.digest).toBe('verified');
    expect(net.model.nodes.length).toBeGreaterThan(10);
    expect(components(net.model)).toBe(1);
  });

  it('turns a link that is not http or https into no link at all', () => {
    expect(G.safeHref('javascript:alert(1)')).toBeNull();
    expect(G.safeHref('data:text/html,x')).toBeNull();
    expect(G.safeHref('https://a.example/x')).toBe('https://a.example/x');
  });
});
