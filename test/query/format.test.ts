// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import * as engine from 'oxigraph';
import { describe, expect, it } from 'vitest';
import { GRAPH_HINT, GRAPH_HINT_EXAMPLE } from '../../src/core/builtin-tools';
import { EXAMPLES, FIRST_QUERY } from '../../src/query/examples';
import { PREFIXES, rowsText, SUMMARY_QUERIES, summaryText } from '../../src/query/format';
import { QUERY_LIMITS } from '../../src/query/protocol';
import { createQueryHandler } from '../../src/query/worker-core';

const nodes = {
  main: readFileSync('fixtures/graph/asc-graph.nq'),
  patterns: readFileSync('fixtures/graph/pat-graph.nq'),
};
function ask(node: keyof typeof nodes) {
  const handler = createQueryHandler(engine);
  handler.load(nodes[node]);
  return (text: string, maxRows = 25) => handler.run(1, text, maxRows);
}
const limits = { rows: QUERY_LIMITS.modelRows, chars: QUERY_LIMITS.modelChars };

describe('rowsText', () => {
  it('writes a header line and tab-separated rows with prefixed names', () => {
    const run = ask('main');
    const answer = run(
      'SELECT ?c ?n WHERE { ?c a <https://w3id.org/agentic-system-core/ns#Cluster> . ?c <http://www.w3.org/2004/02/skos/core#prefLabel> ?n } ORDER BY ?c',
    );
    const text = rowsText(answer.json ?? '', answer.total ?? 0, limits);
    const [header, first] = text.split('\n');
    expect(header).toBe('?c\t?n');
    expect(first).toMatch(/^<https:\/\/agenticsystemcore\.com\/clusters\/[^>]+>\t"/);
  });

  it('cuts at 25 rows and says how many more there are', () => {
    const answer = ask('main')('SELECT ?s ?p ?o WHERE { ?s ?p ?o }', 25);
    const text = rowsText(answer.json ?? '', answer.total ?? 0, limits);
    expect(text.split('\n')).toHaveLength(1 + 25 + 1);
    expect(text.split('\n').at(-1)).toBe('[cut: 352 more rows]');
  });

  it('cuts at the character limit and says how many rows were left out', () => {
    const answer = ask('main')('SELECT ?s ?p ?o WHERE { ?s ?p ?o }', 25);
    const text = rowsText(answer.json ?? '', answer.total ?? 0, { rows: 25, chars: 300 });
    expect(text.length).toBeLessThanOrEqual(330);
    expect(text).toMatch(/\[cut: \d+ more rows\]$/);
  });

  it('writes an ASK answer, an empty result and keeps a literal on one line', () => {
    const run = ask('main');
    expect(rowsText(run('ASK { ?s ?p ?o }').json ?? '', 0, limits)).toBe('ASK answered yes.');
    expect(rowsText(run('SELECT ?s WHERE { ?s <urn:none> ?o }').json ?? '', 0, limits)).toBe(
      'No rows.',
    );
    const json = JSON.stringify({
      head: { vars: ['t'] },
      results: { bindings: [{ t: { type: 'literal', value: 'a\nb\tc' } }] },
    });
    expect(rowsText(json, 1, limits)).toBe('?t\n"a b c"');
  });

  it('knows the prefixes of the node vocabulary', () => {
    expect(Object.keys(PREFIXES)).toEqual(
      expect.arrayContaining(['asc', 'dcterms', 'skos', 'xsd', 'rdf', 'rdfs', 'schema', 'prov']),
    );
  });
});

describe('summary', () => {
  it('runs on both nodes with the three fixed queries and stays within 1,500 characters', () => {
    for (const node of ['main', 'patterns'] as const) {
      const run = ask(node);
      const part = (text: string): string => {
        const answer = run(text, 25);
        return rowsText(answer.json ?? '', answer.total ?? 0, { rows: 25, chars: 1500 });
      };
      const text = summaryText({
        classes: part(SUMMARY_QUERIES.classes),
        properties: part(SUMMARY_QUERIES.properties),
        sample: part(SUMMARY_QUERIES.sample),
      });
      expect(text.length, node).toBeLessThanOrEqual(QUERY_LIMITS.summaryChars);
      expect(text.split('\n').length, node).toBeLessThanOrEqual(25);
      expect(text, node).toContain('asc:Concept');
      if (node === 'main') expect(text).toContain('skos:prefLabel');
    }
  });
});

describe('GRAPH_HINT is true of both live nodes', () => {
  const names = [...GRAPH_HINT.matchAll(/\b(?:asc|skos|dcterms):[A-Za-z]+/g)].map((m) => m[0]);

  it('runs its example query and gets rows on both nodes', () => {
    const prefixes = Object.entries(PREFIXES)
      .map(([p, ns]) => `PREFIX ${p}: <${ns}>`)
      .join('\n');
    for (const node of ['main', 'patterns'] as const) {
      const answer = ask(node)(`${prefixes}\n${GRAPH_HINT_EXAMPLE}`);
      expect(answer.error, node).toBeUndefined();
      expect(answer.total, node).toBeGreaterThan(0);
    }
  });

  it('names only classes and properties that occur in both graphs', () => {
    const prefixes = Object.entries(PREFIXES)
      .map(([p, ns]) => `PREFIX ${p}: <${ns}>`)
      .join('\n');
    const absent = new Map<string, string[]>();
    for (const node of ['main', 'patterns'] as const) {
      const run = ask(node);
      for (const name of new Set(names)) {
        // Procedure is a class of the main node only; the hint says so by listing it as a class the node may have.
        if (name === 'asc:Procedure') continue;
        const found = run(`${prefixes}\nASK { { ?s a ${name} } UNION { ?s ${name} ?o } }`);
        if (!(found.json ?? '').includes('true'))
          absent.set(node, [...(absent.get(node) ?? []), name]);
      }
    }
    expect([...absent]).toEqual([]);
  });
});

describe('the examples of the Query tab', () => {
  it('are the site’s first query and the ten questions, each with its prefix lines', () => {
    expect(EXAMPLES).toHaveLength(10);
    expect(EXAMPLES.map((example) => example.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const example of EXAMPLES) expect(example.sparql).toMatch(/^PREFIX asc: </);
    expect(FIRST_QUERY).toContain('LIMIT 100');
  });

  it('run on both nodes without an engine error, except the two that hold a placeholder to fill in', () => {
    for (const node of ['main', 'patterns'] as const) {
      const run = ask(node);
      for (const example of EXAMPLES.filter((item) => !item.sparql.includes('<S...>'))) {
        expect(run(example.sparql).error, `${node} question ${example.number}`).toBeUndefined();
      }
      expect(run(FIRST_QUERY).total).toBeGreaterThan(0);
    }
    expect(
      EXAMPLES.filter((item) => item.sparql.includes('<S...>')).map((item) => item.number),
    ).toEqual([4, 9]);
  });

  it('marks every question that needs a name or a list of names from the user', () => {
    expect(EXAMPLES.filter((item) => item.needsEdit).map((item) => item.number)).toEqual([
      1, 2, 3, 4, 5, 9, 10,
    ]);
  });
});
