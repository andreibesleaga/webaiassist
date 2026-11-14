// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGuardedFetch, type ShimDeps } from '../../src/adapters/graph-fetch-shim';
import type { GuardedFile } from '../../src/adapters/graph-fetch-guard';
import type { FileOutcome } from '../../src/core/site-files';

const fixture = (name: string): string => readFileSync(`fixtures/graph/${name}`, 'utf8');
const TAB = 'https://agenticsystemcore.com';
const PEER = 'https://patterns.agenticsystemcore.com';
const base64 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('base64');
const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const found = (text: string, contentType: string): FileOutcome => ({
  state: 'found',
  text,
  cut: false,
  link: '',
  contentType,
});

interface Setup {
  readonly deps: ShimDeps;
  readonly tabReads: GuardedFile[];
  readonly network: { url: string; init: RequestInit | undefined }[];
  readonly problems: string[];
  readonly approved: Set<string>;
}

function setup(files: Partial<Record<GuardedFile, FileOutcome>>, peer?: () => Response): Setup {
  const tabReads: GuardedFile[] = [];
  const network: Setup['network'] = [];
  const problems: string[] = [];
  const approved = new Set<string>();
  const deps: ShimDeps = {
    state: { tabOrigin: TAB, approved },
    readTab: (spec) => {
      tabReads.push(spec);
      return Promise.resolve(files[spec] ?? { state: 'not-published' });
    },
    realFetch: (url, init) => {
      network.push({ url: urlOf(url), init });
      return Promise.resolve(peer ? peer() : new Response('', { status: 404 }));
    },
    sha256: (bytes) => Promise.resolve(base64(bytes)),
    onProblem: (text) => problems.push(text),
  };
  return { deps, tabReads, network, problems, approved };
}

const LINKSET = found(fixture('asc-linkset.json'), 'application/linkset+json');
const GRAPH = found(fixture('asc-graph.jsonld'), 'application/ld+json');

describe('the guarded fetch: the node’s own files', () => {
  it('serves the linkset and the graph from the tab and makes no request of its own', async () => {
    const s = setup({ linkset: LINKSET, 'graph-jsonld': GRAPH });
    const fetchGuarded = createGuardedFetch(s.deps);
    const linkset = await fetchGuarded(`${TAB}/.well-known/knowledge-linkset`);
    expect(linkset.status).toBe(200);
    expect(await linkset.text()).toBe(LINKSET.state === 'found' ? LINKSET.text : '');
    const graph = await fetchGuarded(`${TAB}/graph.jsonld`, { credentials: 'omit' });
    expect(graph.ok).toBe(true);
    expect(graph.headers.get('content-type')).toBe('application/ld+json');
    expect(s.tabReads).toEqual(['linkset', 'graph-jsonld']);
    expect(s.network).toEqual([]);
    expect(s.problems).toEqual([]);
  });

  it('turns a missing file into a 404 and any other trouble into a plain error', async () => {
    const s = setup({ chunks: { state: 'unavailable', why: 'timeout' } });
    const fetchGuarded = createGuardedFetch(s.deps);
    expect((await fetchGuarded(`${TAB}/graph.jsonld`)).status).toBe(404);
    await expect(fetchGuarded(`${TAB}/chunks.jsonl`)).rejects.toThrow(/chunks.jsonl.*no answer/);
  });

  it('refuses a graph whose bytes differ from the digest in the linkset, and says so', async () => {
    const changed = found(`${fixture('asc-graph.jsonld')} `, 'application/ld+json');
    const s = setup({ linkset: LINKSET, 'graph-jsonld': changed });
    const fetchGuarded = createGuardedFetch(s.deps);
    await fetchGuarded(`${TAB}/.well-known/knowledge-linkset`);
    await expect(fetchGuarded(`${TAB}/graph.jsonld`)).rejects.toThrow(/does not match the SHA-256/);
    expect(s.problems).toHaveLength(1);
    expect(s.problems[0]).toContain('/graph.jsonld');
  });

  it('draws a graph with no declared digest and one whose digest matches', async () => {
    const withoutLinkset = setup({ 'graph-jsonld': GRAPH });
    expect((await createGuardedFetch(withoutLinkset.deps)(`${TAB}/graph.jsonld`)).ok).toBe(true);
    const matching = setup({ linkset: LINKSET, 'graph-jsonld': GRAPH });
    const fetchGuarded = createGuardedFetch(matching.deps);
    await fetchGuarded(`${TAB}/.well-known/knowledge-linkset`);
    expect((await fetchGuarded(`${TAB}/graph.jsonld`)).ok).toBe(true);
    expect(matching.problems).toEqual([]);
  });

  it('refuses every other address before anything is sent', async () => {
    const s = setup({});
    const fetchGuarded = createGuardedFetch(s.deps);
    for (const url of [
      `${TAB}/private`,
      'https://evil.example/graph.jsonld',
      `${PEER}/graph.jsonld`,
    ]) {
      await expect(fetchGuarded(url)).rejects.toThrow(/WebAIAssist/);
    }
    expect(s.tabReads).toEqual([]);
    expect(s.network).toEqual([]);
  });
});

describe('the guarded fetch: ticked peers', () => {
  const peerGraph = (): Response =>
    new Response('{"@graph":[]}', {
      status: 200,
      headers: { 'content-type': 'application/ld+json' },
    });

  it('makes a plain request: no cookies, no referrer, no redirect, a time limit', async () => {
    const s = setup({}, peerGraph);
    s.approved.add(PEER);
    const response = await createGuardedFetch(s.deps)(`${PEER}/graph.jsonld`, {
      credentials: 'include',
    });
    expect(await response.text()).toBe('{"@graph":[]}');
    expect(s.network).toHaveLength(1);
    expect(s.network[0]?.url).toBe(`${PEER}/graph.jsonld`);
    expect(s.network[0]?.init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    expect(s.network[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('reads no peer that is not ticked, and nothing but the fixed paths of one that is', async () => {
    const s = setup({}, peerGraph);
    const fetchGuarded = createGuardedFetch(s.deps);
    await expect(fetchGuarded(`${PEER}/graph.jsonld`)).rejects.toThrow(/not ticked/);
    s.approved.add(PEER);
    await expect(fetchGuarded(`${PEER}/ns/agsc.ttl`)).rejects.toThrow(/fixed list/);
    expect(s.network).toEqual([]);
  });

  it('stops at 2 MiB, by the declared length and while streaming', async () => {
    const big = 2 * 1024 * 1024 + 1;
    const declared = setup(
      {},
      () => new Response('x', { headers: { 'content-length': String(big) } }),
    );
    declared.approved.add(PEER);
    await expect(createGuardedFetch(declared.deps)(`${PEER}/graph.jsonld`)).rejects.toThrow(
      /larger than/,
    );
    const streamed = setup({}, () => new Response(new Uint8Array(big)));
    streamed.approved.add(PEER);
    await expect(createGuardedFetch(streamed.deps)(`${PEER}/graph.jsonld`)).rejects.toThrow(
      /larger than/,
    );
  });

  it('checks a peer graph against the digest in that peer’s own linkset', async () => {
    const peerLinkset = fixture('pat-linkset.json');
    const patGraph = fixture('pat-graph.jsonld');
    const answers: Record<string, string> = {
      '/.well-known/knowledge-linkset': peerLinkset,
      '/graph.jsonld': `${patGraph} `,
    };
    const s = setup({});
    s.approved.add(PEER);
    const deps: ShimDeps = {
      ...s.deps,
      realFetch: (url) =>
        Promise.resolve(new Response(answers[new URL(urlOf(url)).pathname] ?? '', { status: 200 })),
    };
    const fetchGuarded = createGuardedFetch(deps);
    await fetchGuarded(`${PEER}/.well-known/knowledge-linkset`);
    await expect(fetchGuarded(`${PEER}/graph.jsonld`)).rejects.toThrow(/does not match/);
    answers['/graph.jsonld'] = patGraph;
    expect((await fetchGuarded(`${PEER}/graph.jsonld`)).ok).toBe(true);
  });

  it('turns a failed peer request (no CORS, offline) into the explorer’s own “blocked” text', async () => {
    const s = setup({});
    s.approved.add(PEER);
    const deps: ShimDeps = {
      ...s.deps,
      realFetch: () => Promise.reject(new TypeError('Failed to fetch')),
    };
    await expect(createGuardedFetch(deps)(`${PEER}/graph.jsonld`)).rejects.toThrow(
      'Failed to fetch',
    );
  });
});
