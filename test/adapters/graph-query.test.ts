// SPDX-License-Identifier: Apache-2.0
// The adapter of the model's graph tool, with a worker that runs in this process over the Node build
// of the pinned engine (the real worker is src/entries/query-worker.ts), and the node's files read from
// fixtures/graph (recorded from the live nodes). Fixed clocks are not needed: the timeout tests use a
// worker that never answers and a very short limit.
import { readFileSync } from 'node:fs';
import * as engine from 'oxigraph';
import { describe, expect, it } from 'vitest';
import type { FileOutcome } from '../../src/core/site-files';
import { createGraphQuery } from '../../src/adapters/graph-query';
import { loadNodeFile } from '../../src/adapters/graph-load';
import { createQuerySession, type WorkerPort } from '../../src/adapters/query-session';
import { sha256Base64 } from '../../src/adapters/sha256';
import type { FromWorker, ToWorker } from '../../src/query/protocol';
import { createQueryHandler } from '../../src/query/worker-core';

const ORIGIN = 'https://agenticsystemcore.com';
const text = (file: string): string => readFileSync(`fixtures/graph/${file}`, 'utf8');
const found = (body: string, sha256?: string): FileOutcome => ({
  state: 'found',
  text: body,
  cut: false,
  link: '',
  contentType: 'application/n-quads',
  ...(sha256 === undefined ? {} : { sha256 }),
});

interface Setup {
  starts: number;
  terminated: number;
  reads: string[];
}

function fakeWorker(setup: Setup, options: { silent?: boolean } = {}): WorkerPort {
  const handler = createQueryHandler(engine);
  const port: WorkerPort = {
    onmessage: null,
    onerror: null,
    terminate: () => void (setup.terminated += 1),
    postMessage: (message: ToWorker) => {
      const reply = (data: FromWorker): void =>
        void queueMicrotask(() => port.onmessage?.({ data }));
      if (message.type === 'load') {
        const loaded = handler.load(message.bytes);
        reply(
          loaded.ok
            ? { type: 'ready', size: loaded.size }
            : { type: 'error', message: loaded.message },
        );
      } else if (!options.silent) {
        reply(handler.run(message.id, message.text, message.maxRows));
      }
    },
  };
  setup.starts += 1;
  return port;
}

function adapter(over: { linkset?: string; graph?: string } = {}) {
  const setup: Setup = { starts: 0, terminated: 0, reads: [] };
  const linkset = over.linkset ?? text('asc-linkset.json');
  const graph = over.graph ?? text('asc-graph.nq');
  const query = createGraphQuery({
    readerFor: () => (spec) => {
      setup.reads.push(spec);
      if (spec === 'linkset') return Promise.resolve(found(linkset));
      if (spec === 'graph-nq') return Promise.resolve(found(graph));
      return Promise.resolve<FileOutcome>({ state: 'not-published' });
    },
    sha256: sha256Base64,
    makeWorker: () => fakeWorker(setup),
  });
  return { query, setup };
}
const scope = { tabId: 1, origin: ORIGIN };

describe('available', () => {
  it('is true for a node whose linkset names graph.nq with a digest, false otherwise', async () => {
    expect(await adapter().query.available(scope)).toBe(true);
    expect(await adapter({ linkset: '{"linkset":[{}]}' }).query.available(scope)).toBe(false);
  });
});

describe('run', () => {
  it('answers a count, as header and rows, and reads the two files once each', async () => {
    const { query, setup } = adapter();
    const sparql =
      'PREFIX asc: <https://w3id.org/agentic-system-core/ns#> SELECT (COUNT(?c) AS ?n) WHERE { ?c a asc:Concept }';
    const outcome = await query.run(scope, sparql);
    expect(outcome).toEqual({ ok: true, text: '?n\n"13"^^xsd:integer' });
    await query.run(scope, 'ASK { ?s ?p ?o }');
    expect(setup.reads).toEqual(['linkset', 'graph-nq']);
    expect(setup.starts).toBe(1);
  });

  it('gives the engine’s refusal of an update as the text, and the repair counts come from the caller', async () => {
    const outcome = await adapter().query.run(scope, 'DROP ALL');
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toMatch(/read|update|refus/i);
  });

  it('refuses a query longer than the tool allows, without a worker', async () => {
    const { query, setup } = adapter();
    const outcome = await query.run(scope, `ASK { ?s ?p ?o } #${'x'.repeat(1500)}`);
    expect(outcome).toMatchObject({ ok: false });
    expect(setup.starts).toBe(0);
  });

  it('refuses a graph that differs from the digest in the linkset', async () => {
    const outcome = await adapter({ graph: `${text('asc-graph.nq')}\n# changed` }).query.run(
      scope,
      'ASK { ?s ?p ?o }',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toMatch(/does not match the SHA-256 digest/);
  });

  it('refuses a node whose linkset does not name graph.nq', async () => {
    const outcome = await adapter({ linkset: '{"linkset":[{}]}' }).query.run(
      scope,
      'ASK { ?s ?p ?o }',
    );
    expect(outcome.text).toMatch(/does not publish a graph at the standard place/);
  });

  it('writes the summary from three fixed queries', async () => {
    const outcome = await adapter().query.summary(scope);
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain('asc:Concept');
    expect(outcome.text.length).toBeLessThanOrEqual(1500);
  });
});

describe('the session', () => {
  const read = (spec: string): Promise<FileOutcome> =>
    Promise.resolve(
      spec === 'linkset' ? found(text('asc-linkset.json')) : found(text('asc-graph.nq')),
    );
  const deps = (setup: Setup, silent = false) => ({
    loadBytes: () => loadNodeFile({ readTab: read, sha256: sha256Base64 }, ORIGIN),
    makeWorker: () => fakeWorker(setup, { silent }),
  });

  it('ends the worker when a query runs past its time, and starts a new one for the next query', async () => {
    const setup: Setup = { starts: 0, terminated: 0, reads: [] };
    let silent = true;
    const session = createQuerySession({
      ...deps(setup),
      makeWorker: () => fakeWorker(setup, { silent }),
    });
    const slow = await session.run('SELECT * WHERE { ?s ?p ?o }', { maxRows: 5, ms: 30 });
    expect(slow).toEqual({ kind: 'timeout' });
    expect(setup.terminated).toBe(1);
    silent = false;
    const next = await session.run('ASK { ?s ?p ?o }', { maxRows: 5, ms: 1000 });
    expect(next.kind).toBe('answer');
    expect(setup.starts).toBe(2);
  });

  it('ends the worker on stop() and when the run signal is aborted', async () => {
    const setup: Setup = { starts: 0, terminated: 0, reads: [] };
    const session = createQuerySession(deps(setup, true));
    const stopped = session.run('SELECT * WHERE { ?s ?p ?o }', { maxRows: 5, ms: 5000 });
    await new Promise((r) => setTimeout(r, 20));
    session.stop();
    expect(await stopped).toEqual({ kind: 'stopped' });
    const signal = { aborted: false };
    const aborted = session.run('SELECT * WHERE { ?s ?p ?o }', { maxRows: 5, ms: 5000, signal });
    await new Promise((r) => setTimeout(r, 20));
    signal.aborted = true;
    expect(await aborted).toEqual({ kind: 'stopped' });
  });

  it('answers two queries asked at once, one after the other', async () => {
    const setup: Setup = { starts: 0, terminated: 0, reads: [] };
    const session = createQuerySession(deps(setup));
    const options = { maxRows: 5, ms: 5000 };
    const [first, second] = await Promise.all([
      session.run('ASK { ?s ?p ?o }', options),
      session.run('SELECT ?s WHERE { ?s ?p ?o } LIMIT 2', options),
    ]);
    expect(first.kind).toBe('answer');
    expect(second.kind).toBe('answer');
    expect(setup.starts).toBe(1);
  });

  it('reports an engine that does not start', async () => {
    const session = createQuerySession({
      ...deps({ starts: 0, terminated: 0, reads: [] }),
      makeWorker: () => {
        const port = fakeWorker({ starts: 0, terminated: 0, reads: [] });
        port.postMessage = () => queueMicrotask(() => port.onerror?.({}));
        return port;
      },
    });
    expect(await session.ready()).toEqual({ ok: false, text: 'The query engine could not start.' });
  });
});
