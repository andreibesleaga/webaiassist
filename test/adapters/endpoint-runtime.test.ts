// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  EndpointRuntime,
  endpointUrlProblem,
  isLocalEndpoint,
  type FetchLike,
} from '../../src/adapters/endpoint-runtime';
import type { LoadProgress } from '../../src/core/ports/model-runtime';

const encoder = new TextEncoder();

/** A Response whose body streams the given SSE text in the given pieces. */
function sse(pieces: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const delta = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

interface Seen {
  readonly url: string;
  readonly init: RequestInit;
}

function fakeFetch(replies: Response[], seen: Seen[]): FetchLike {
  return (url, init) => {
    seen.push({ url, init });
    const reply = replies.shift();
    return reply ? Promise.resolve(reply) : Promise.reject(new TypeError('Failed to fetch'));
  };
}

const OLLAMA = { url: 'http://localhost:11434/v1', model: 'qwen3:0.6b', apiKey: '' };

describe('isLocalEndpoint', () => {
  it('is true for localhost and 127.0.0.1 with any port or scheme, and for nothing else', () => {
    for (const url of [
      'http://localhost:11434/v1',
      'http://127.0.0.1:1234/v1',
      'https://localhost/v1',
    ]) {
      expect(isLocalEndpoint(url)).toBe(true);
    }
    for (const url of [
      'https://api.example.com/v1',
      'https://localhost.example.com/v1',
      'http://192.168.1.5:11434/v1',
      'not an address',
    ]) {
      expect(isLocalEndpoint(url)).toBe(false);
    }
  });
});

describe('endpointUrlProblem', () => {
  it('accepts https anywhere and http only on this computer', () => {
    expect(endpointUrlProblem('https://api.example.com/v1')).toBeUndefined();
    expect(endpointUrlProblem('http://localhost:1234/v1')).toBeUndefined();
    expect(endpointUrlProblem('http://127.0.0.1:8080/v1')).toBeUndefined();
    expect(endpointUrlProblem('http://192.168.1.5:8000/v1')).toMatch(/https/);
    expect(endpointUrlProblem('ftp://x')).toMatch(/https/);
    expect(endpointUrlProblem('not a url')).toMatch(/not a web address/);
  });
});

describe('EndpointRuntime (OpenAI-compatible chat completions)', () => {
  it('checks the endpoint on load with GET /models and the key', async () => {
    const seen: Seen[] = [];
    const runtime = new EndpointRuntime(
      { ...OLLAMA, apiKey: 'sk-1' },
      fakeFetch([new Response('{"data":[]}')], seen),
    );
    const progress: LoadProgress[] = [];
    await runtime.load(OLLAMA.model, (p) => progress.push(p));
    expect(seen[0]?.url).toBe('http://localhost:11434/v1/models');
    expect((seen[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer sk-1');
    expect(progress).toEqual([{ fraction: 1, text: 'Connected to http://localhost:11434/v1' }]);
  });

  it('says what went wrong when the endpoint refuses or cannot be reached', async () => {
    const refused = new EndpointRuntime(OLLAMA, fakeFetch([new Response('', { status: 401 })], []));
    await expect(refused.load('m', () => {})).rejects.toThrow(/answered 401/);
    const away = new EndpointRuntime(OLLAMA, fakeFetch([], []));
    await expect(away.load('m', () => {})).rejects.toThrow(/could not reach.*Failed to fetch/);
    const bad = new EndpointRuntime({ ...OLLAMA, url: 'http://10.0.0.1/v1' }, fakeFetch([], []));
    await expect(bad.load('m', () => {})).rejects.toThrow(/https/);
  });

  it('names the Ollama setting when the endpoint refuses the extension (403)', async () => {
    const forbidden = new EndpointRuntime(
      OLLAMA,
      fakeFetch([new Response('', { status: 403 })], []),
    );
    await expect(forbidden.load('m', () => {})).rejects.toThrow(
      /answered 403.*OLLAMA_ORIGINS=chrome-extension:\/\/\*/,
    );
  });

  it('streams the reply from server-sent events, across split chunks', async () => {
    const seen: Seen[] = [];
    const stream = sse([delta('{"ans'), `${delta('wer": "hi"}')}data: [DO`, 'NE]\n\n']);
    const runtime = new EndpointRuntime(OLLAMA, fakeFetch([new Response('{}'), stream], seen));
    await runtime.load('m', () => {});
    const tokens: string[] = [];
    const reply = await runtime.chat({
      messages: [{ role: 'tool', content: 'R' }],
      onToken: (t) => tokens.push(t),
    });
    expect(reply).toBe('{"answer": "hi"}');
    expect(tokens).toEqual(['{"ans', 'wer": "hi"}']);
    expect(seen[1]?.url).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(seen[1]?.init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      model: 'qwen3:0.6b',
      stream: true,
      temperature: 0.2,
      messages: [{ role: 'user', content: 'R' }],
    });
    expect((seen[1]?.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('skips comments, empty deltas and lines it cannot read', async () => {
    const stream = sse([': ping\n', 'data: {oops\n', 'data: {"choices":[]}\n', delta('ok')]);
    const runtime = new EndpointRuntime(OLLAMA, fakeFetch([new Response('{}'), stream], []));
    await runtime.load('m', () => {});
    expect(await runtime.chat({ messages: [] })).toBe('ok');
  });

  it('keeps the text so far when the user stops the reply', async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(delta('par')));
      },
      pull() {
        controller.abort();
        return Promise.reject(new DOMException('stopped', 'AbortError'));
      },
    });
    const runtime = new EndpointRuntime(
      OLLAMA,
      fakeFetch([new Response('{}'), new Response(body)], []),
    );
    await runtime.load('m', () => {});
    expect(await runtime.chat({ messages: [], signal: controller.signal })).toBe('par');
  });

  it('reports an error status and refuses to chat before load', async () => {
    const runtime = new EndpointRuntime(
      OLLAMA,
      fakeFetch([new Response('{}'), new Response('busy', { status: 503 })], []),
    );
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/not connected/);
    await runtime.load('m', () => {});
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/answered 503/);
    await runtime.unload();
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/not connected/);
  });

  it('uses prompted JSON and no GPU', () => {
    expect(new EndpointRuntime(OLLAMA, fakeFetch([], [])).capabilities()).toEqual({
      nativeToolCalls: false,
      jsonConstraint: false,
      contextTokens: 8192,
    });
  });
});

describe('EndpointRuntime: addresses, limits and the context window', () => {
  it.each([
    'http://[::1]:8080/v1',
    'https://user:pw@llm.example/v1',
    'https://user@llm.example/v1',
  ])('refuses %s', (url) => {
    expect(endpointUrlProblem(url)).toBeDefined();
  });

  it('refuses redirects and gives the connection check a time limit', async () => {
    const seen: Seen[] = [];
    const runtime = new EndpointRuntime(OLLAMA, fakeFetch([new Response('{}')], seen));
    await runtime.load('m', () => undefined);
    expect(seen[0]?.init.redirect).toBe('error');
    expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('says when the endpoint did not answer in time', async () => {
    const timedOut: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const cancel = new AbortController();
    const runtime = new EndpointRuntime(OLLAMA, timedOut);
    const loading = runtime.load('m', () => undefined, cancel.signal);
    cancel.abort(new DOMException('late', 'TimeoutError'));
    await expect(loading).rejects.toThrow(/no answer in 15 seconds/);
  });

  it('reports the context window set in Options, 8192 by default', () => {
    const fetchNone: FetchLike = () => Promise.reject(new Error('unused'));
    expect(new EndpointRuntime(OLLAMA, fetchNone).capabilities().contextTokens).toBe(8192);
    const big = new EndpointRuntime({ ...OLLAMA, contextTokens: 32768 }, fetchNone);
    expect(big.capabilities().contextTokens).toBe(32768);
  });
});
