// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteReadDeps, SiteScripting, Timer } from '../../src/adapters/site-files';
import { readGraphFile } from '../../src/adapters/graph-files';
import { GRAPH_FILES, graphSpecOf } from '../../src/core/graph-files';
import { LIMITS } from '../../src/core/site-files';
import type { PageFileRequest } from '../../src/adapters/site-page-scripts';

const ORIGIN = 'https://site.test';
const TARGET = { tabId: 7, origin: ORIGIN };

function reply(request: PageFileRequest, change: Record<string, unknown> = {}): unknown {
  return {
    type: 'site/graph-file',
    id: request.id,
    origin: ORIGIN,
    status: 200,
    contentType: 'application/ld+json',
    link: '',
    text: '{"@graph":[]}',
    cut: false,
    ...change,
  };
}

interface Fake extends SiteReadDeps {
  readonly asked: PageFileRequest[];
}

function fake(answer: (request: PageFileRequest) => unknown): Fake {
  const asked: PageFileRequest[] = [];
  const scripting: SiteScripting = {
    executeScript: async (injection) => {
      const request = injection.args?.[0] as PageFileRequest;
      asked.push(request);
      return [{ result: await answer(request) }];
    },
  };
  const timer = (ms: number): Timer => {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const done = new Promise<void>((resolve) => {
      handle = setTimeout(resolve, ms);
    });
    return { done, cancel: () => clearTimeout(handle) };
  };
  return { scripting, timer, asked };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const spec = graphSpecOf('graph-jsonld');

describe('readGraphFile', () => {
  it('asks for the fixed path, the tab origin, the cap and the graph message type', async () => {
    const deps = fake((request) => reply(request));
    expect(await readGraphFile(deps, TARGET, spec)).toMatchObject({ state: 'found' });
    expect(deps.asked[0]).toEqual({
      id: 'graph-jsonld',
      path: '/graph.jsonld',
      origin: ORIGIN,
      accept: 'application/ld+json, application/json',
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: LIMITS.fileMs,
      type: 'site/graph-file',
    });
  });

  it.each(GRAPH_FILES.map((item) => item.id))(
    'carries the cap of %s into the request',
    async (id) => {
      const deps = fake((request) => reply(request, { contentType: 'text/plain' }));
      await readGraphFile(deps, TARGET, graphSpecOf(id));
      expect(deps.asked[0]?.maxBytes).toBe(graphSpecOf(id).maxBytes);
    },
  );

  const states: [string, Record<string, unknown>, unknown][] = [
    ['404', { status: 404, contentType: 'text/html' }, { state: 'not-published' }],
    ['a page instead of data', { contentType: 'text/html' }, { state: 'not-usable', why: 'type' }],
    ['a cut JSON file', { cut: true }, { state: 'not-usable', why: 'size' }],
    ['a cut N-Quads file', { cut: true, contentType: 'application/n-quads' }, undefined],
    [
      'a timeout in the page script',
      { failed: 'timeout', status: 0 },
      { state: 'unavailable', why: 'timeout' },
    ],
    ['a server error', { status: 503 }, { state: 'unavailable', why: 'server' }],
  ];
  it.each(states)('judges %s', async (name, change, expected) => {
    const target = name.includes('N-Quads') ? graphSpecOf('graph-nq') : spec;
    const deps = fake((request) => reply(request, change));
    const outcome = await readGraphFile(deps, TARGET, target);
    expect(outcome).toEqual(expected ?? { state: 'not-usable', why: 'size' });
  });

  it('refuses an answer of the site-file kind, for another file, from another origin or in the wrong shape', async () => {
    const wrongType = fake((request) => reply(request, { type: 'site/file' }));
    const wrongId = fake((request) => reply(request, { id: 'chunks' }));
    const wrongOrigin = fake((request) => reply(request, { origin: 'https://evil.test' }));
    const unknownId = fake((request) => reply(request, { id: 'llms' }));
    const overCap = fake((request) => reply(request, { text: 'x'.repeat(4 * 1024 * 1024 + 1) }));
    const junk = fake(() => 'text');
    for (const deps of [wrongType, wrongId, wrongOrigin, unknownId, overCap, junk]) {
      expect(await readGraphFile(deps, TARGET, spec)).toEqual({
        state: 'not-usable',
        why: 'parse',
      });
    }
  });

  it('is "unavailable" when the script cannot run or never answers', async () => {
    const throws = fake(() => {
      throw new Error('Cannot access contents of the page');
    });
    expect(await readGraphFile(throws, TARGET, spec)).toEqual({
      state: 'unavailable',
      why: 'network',
    });
    const silent = fake(() => new Promise(() => undefined));
    const pending = readGraphFile(silent, TARGET, spec);
    await vi.advanceTimersByTimeAsync(LIMITS.fileMs + 1000);
    expect(await pending).toEqual({ state: 'unavailable', why: 'timeout' });
  });
});
