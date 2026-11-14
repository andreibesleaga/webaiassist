// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSiteFile, type PageFileRequest } from '../../src/adapters/site-page-scripts';

const ORIGIN = 'https://site.test';
const REQUEST: PageFileRequest = {
  id: 'llms',
  path: '/llms.txt',
  origin: ORIGIN,
  accept: 'text/plain',
  maxBytes: 100,
  timeoutMs: 5000,
};

type FetchInit = RequestInit & { signal: AbortSignal };

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function respond(text: string, headers: Record<string, string> = {}, status = 200): Response {
  const bytes = new TextEncoder().encode(text);
  return new Response(streamOf([bytes]), {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  });
}

let calls: { url: string; init: FetchInit }[];

function stubFetch(handler: (url: string, init: FetchInit) => Promise<Response>): void {
  calls = [];
  vi.stubGlobal('fetch', (url: string, init: FetchInit) => {
    calls.push({ url, init });
    return handler(url, init);
  });
}

beforeEach(() => {
  vi.stubGlobal('location', { origin: ORIGIN });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchSiteFile (the function that runs in the tab)', () => {
  it('sends a GET without cookies, referrer, cache or redirects, to the tab origin', async () => {
    stubFetch(() => Promise.resolve(respond('# T')));
    await fetchSiteFile(REQUEST);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ORIGIN}/llms.txt`);
    expect(calls[0]?.init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      mode: 'same-origin',
      headers: { Accept: 'text/plain' },
    });
  });

  it('returns status, type, link header and text as a site/file message', async () => {
    stubFetch(() => Promise.resolve(respond('# T', { link: '<x>; rel="profile"' })));
    expect(await fetchSiteFile(REQUEST)).toEqual({
      type: 'site/file',
      id: 'llms',
      origin: ORIGIN,
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      link: '<x>; rel="profile"',
      text: '# T',
      cut: false,
    });
  });

  it('refuses to run when the tab is no longer on the origin the panel expects', async () => {
    stubFetch(() => Promise.resolve(respond('x')));
    vi.stubGlobal('location', { origin: 'https://other.test' });
    expect(await fetchSiteFile(REQUEST)).toMatchObject({
      failed: 'network',
      origin: 'https://other.test',
    });
    expect(calls).toHaveLength(0);
  });

  it.each(['//evil.test/x', 'https://evil.test/x', '/a b', '/../x?y', 'llms.txt', ''])(
    'refuses the path %j: only a path from the root of the tab origin is built',
    async (path) => {
      stubFetch(() => Promise.resolve(respond('x')));
      const answer = await fetchSiteFile({ ...REQUEST, path });
      expect(answer).toMatchObject({ failed: 'network' });
      expect(calls).toHaveLength(0);
    },
  );

  it('cuts a body at the cap while reading and stops the stream', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(60).fill(65));
      },
      cancel() {
        cancelled = true;
      },
    });
    stubFetch(() =>
      Promise.resolve(new Response(stream, { headers: { 'content-type': 'text/plain' } })),
    );
    const answer = (await fetchSiteFile(REQUEST)) as { text: string; cut: boolean };
    expect(answer.text).toHaveLength(100);
    expect(answer.cut).toBe(true);
    expect(cancelled).toBe(true);
  });

  it('marks a file cut when its declared length is over the cap', async () => {
    stubFetch(() => Promise.resolve(respond('short', { 'content-length': '5000000' })));
    expect(await fetchSiteFile(REQUEST)).toMatchObject({ cut: true, text: 'short' });
  });

  it('reports a failed request as "network" and a refused redirect the same way', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await fetchSiteFile(REQUEST)).toMatchObject({ failed: 'network', status: 0 });
  });

  it('ends a file that never finishes at the time limit', async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = fetchSiteFile(REQUEST);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ failed: 'timeout' });
  });

  it('ends a body that stalls after the headers at the time limit', async () => {
    vi.useFakeTimers();
    stubFetch((_url, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          init.signal.addEventListener('abort', () =>
            controller.error(new DOMException('aborted', 'AbortError')),
          );
        },
      });
      return Promise.resolve(new Response(stream, { headers: { 'content-type': 'text/plain' } }));
    });
    const pending = fetchSiteFile(REQUEST);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ failed: 'timeout' });
  });
});
