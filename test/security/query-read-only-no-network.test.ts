// SPDX-License-Identifier: Apache-2.0
// The query engine of WebAIAssist reads a graph that was handed to it and answers; it never asks the
// network, never turns text into HTML or code, and is never started by the engine file's own loader
// (queryWorkerMain of engine.js reads an address; WebAIAssist hands bytes in instead).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');
const SINKS = /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/;
const NETWORK =
  /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|navigator\.|import\(/;

const WORKER_SIDE = [
  'src/entries/query-worker.ts',
  'src/query/worker-core.ts',
  'src/query/protocol.ts',
  'src/query/format.ts',
  'src/query/examples.ts',
];
const PAGE_SIDE = [
  'src/adapters/query-session.ts',
  'src/adapters/graph-query.ts',
  'src/adapters/graph-load.ts',
  'src/core/builtin-tools.ts',
  'src/ui/explorer/query-tab.ts',
  'src/ui/explorer/vocab-tab.ts',
  'src/ui/explorer/page-data-tab.ts',
  'src/ui/explorer/result-table.ts',
];

describe('the query worker side has no network call and no sink', () => {
  it.each(WORKER_SIDE)('%s', (path) => {
    expect(read(path)).not.toMatch(NETWORK);
    expect(read(path)).not.toMatch(SINKS);
  });

  it('the planted calls are found', () => {
    expect(NETWORK.test('await fetch(url)')).toBe(true);
    expect(NETWORK.test('new WebSocket(x)')).toBe(true);
    expect(NETWORK.test('store.query(text)')).toBe(false);
  });
});

describe('the page side of the query tools has no sink and builds no address', () => {
  it.each(PAGE_SIDE)('%s', (path) => {
    expect(read(path)).not.toMatch(SINKS);
    expect(read(path)).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  });
});

describe('the copied engine files', () => {
  it.each(['tokens.js', 'engine.js', 'view.js'])('%s has no HTML or code sink', (name) => {
    expect(read(`third_party/agsc-query/${name}`)).not.toMatch(SINKS);
  });

  it('the one fetch in engine.js is inside queryWorkerMain, which no WebAIAssist file uses', () => {
    const engine = read('third_party/agsc-query/engine.js');
    const loader = engine.slice(engine.indexOf('function queryWorkerMain'));
    expect(engine.slice(0, engine.indexOf('function queryWorkerMain'))).not.toMatch(/\bfetch\b/);
    expect(loader).toMatch(/scope\.fetch/);
    for (const path of [...WORKER_SIDE, ...PAGE_SIDE]) {
      expect(read(path), path).not.toContain('queryWorkerMain');
    }
  });

  it('the worker starts the engine with the extension’s own wasm file, from its own address', () => {
    const entry = read('src/entries/query-worker.ts');
    expect(entry).toContain("new URL('model-libs/oxigraph.wasm', self.location.href)");
    expect(entry).not.toMatch(/https?:\/\//);
  });
});
