// SPDX-License-Identifier: Apache-2.0
// The query engine's read-only rules and limits, run with the pinned engine.js over the Node build of
// the same oxigraph release (the engine's own tests do the same), against graph.nq files recorded
// from the live nodes (fixtures/graph). No browser, no network.
import { readFileSync } from 'node:fs';
import * as engine from 'oxigraph';
import { describe, expect, it } from 'vitest';
import { queryCheck, queryRefusal } from '../../third_party/agsc-query/tokens.js';
import { QUERY_LIMITS } from '../../src/query/protocol';
import { createQueryHandler, cutRows } from '../../src/query/worker-core';

const asc = readFileSync('fixtures/graph/asc-graph.nq');
const patterns = readFileSync('fixtures/graph/pat-graph.nq');

function loaded(bytes: Uint8Array = asc) {
  const handler = createQueryHandler(engine);
  const result = handler.load(bytes);
  if (!result.ok) throw new Error(result.message);
  return handler;
}

const count = (json: string | undefined): number =>
  (JSON.parse(json ?? '{}') as { results: { bindings: unknown[] } }).results.bindings.length;

describe('loading', () => {
  it('loads the main node (377 statements) and the Patterns node', () => {
    const handler = createQueryHandler(engine);
    expect(handler.load(asc)).toEqual({ ok: true, size: 377 });
    expect(handler.load(patterns)).toEqual({ ok: true, size: 2353 });
  });

  it('refuses text that is not N-Quads, with a sentence, and keeps nothing', () => {
    const handler = loaded();
    const result = handler.load(new TextEncoder().encode('this is not a graph'));
    expect(result.ok).toBe(false);
    expect(handler.run(1, 'ASK { ?s ?p ?o }', 5).error).toMatch(/No graph is loaded/);
  });

  it('refuses a graph above the statement cap, whole', () => {
    const lines = Array.from(
      { length: QUERY_LIMITS.quads + 1 },
      (_, n) => `<urn:s:${n}> <urn:p> "x" <urn:g> .`,
    ).join('\n');
    const result = createQueryHandler(engine).load(new TextEncoder().encode(lines));
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toMatch(/at most 200000/);
  });
});

describe('answers', () => {
  it('answers SELECT over the union of the graphs, ASK and CONSTRUCT', () => {
    const handler = loaded();
    const select = handler.run(1, 'SELECT ?c (COUNT(?s) AS ?n) WHERE { ?s a ?c } GROUP BY ?c', 50);
    expect(select.form).toBe('SELECT');
    expect(count(select.json)).toBe(5);
    expect(
      handler.run(2, 'ASK { ?s a <https://w3id.org/agentic-system-core/ns#Concept> }', 1).json,
    ).toContain('true');
    const construct = handler.run(3, 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 3', 50);
    expect(construct.form).toBe('CONSTRUCT');
    expect(count(construct.json)).toBe(3);
  });

  it('cuts the rows to the cap and says how many there were', () => {
    const answer = loaded().run(1, 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }', 25);
    expect(answer.total).toBe(377);
    expect(count(answer.json)).toBe(25);
  });

  it('gives an engine error as a sentence, and refuses a query that is too long', () => {
    const handler = loaded();
    expect(handler.run(1, 'SELECT WHERE {', 5).error).toMatch(
      /^The engine could not run the query: /,
    );
    const long = `ASK { ?s ?p ?o } #${'x'.repeat(QUERY_LIMITS.queryChars)}`;
    expect(handler.run(2, long, 5).error).toMatch(/longer than 4000/);
  });

  it('passes an ASK result through the row cut unchanged', () => {
    expect(cutRows('{"head":{},"boolean":true}', 1)).toEqual({
      json: '{"head":{},"boolean":true}',
      total: 0,
    });
  });
});

describe('read only: the refusal is the engine file’s own sentence', () => {
  const REFUSED: readonly [string, string][] = [
    ['INSERT DATA', 'INSERT DATA { <urn:a> <urn:b> <urn:c> }'],
    ['DELETE WHERE', 'DELETE WHERE { ?s ?p ?o }'],
    ['lower case', 'insert data { <urn:a> <urn:b> <urn:c> }'],
    ['LOAD', 'LOAD <https://evil.example/data>'],
    ['CLEAR', 'CLEAR ALL'],
    ['DROP', 'DROP ALL'],
    ['COPY', 'COPY DEFAULT TO <urn:x>'],
    ['SERVICE', 'SELECT * WHERE { SERVICE <https://evil.example/sparql> { ?s ?p ?o } }'],
    [
      'SERVICE SILENT',
      'SELECT * WHERE { SERVICE SILENT <https://evil.example/sparql> { ?s ?p ?o } }',
    ],
    [
      'SERVICE after a less-than',
      'SELECT * WHERE { FILTER(1<2)SERVICE#>\n <https://evil.example/> { ?s ?p ?o } }',
    ],
  ];
  it.each(REFUSED)('refuses %s and the store is unchanged', (_name, text) => {
    const handler = loaded();
    const answer = handler.run(1, text, 5);
    const sentence = queryRefusal(queryCheck(text));
    expect(sentence, `the tokenizer refuses: ${text}`).not.toBeNull();
    expect(answer.error).toBe(sentence);
    expect(answer.json).toBeUndefined();
    expect(count(handler.run(2, 'SELECT ?s WHERE { ?s ?p ?o } LIMIT 500', 500).json)).toBe(377);
  });

  it('runs a query whose strings, names and comments only look like an update', () => {
    const handler = loaded();
    expect(
      handler.run(1, 'SELECT ?insert WHERE { BIND("DELETE" AS ?insert) } # DROP ALL', 5).error,
    ).toBeUndefined();
  });

  it('reads FROM <remote address> as a name of a graph in the store: empty result, nothing fetched', () => {
    const fetched: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (...args: unknown[]) => {
      fetched.push(args);
      return Promise.reject(new Error('no network in this test'));
    };
    try {
      const answer = loaded().run(1, 'SELECT * FROM <https://evil.example/> WHERE { ?s ?p ?o }', 5);
      expect(answer.error).toBeUndefined();
      expect(count(answer.json)).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
    expect(fetched).toEqual([]);
  });
});
