// SPDX-License-Identifier: Apache-2.0
// Limits of the chat endpoint beyond the first connection: a reply that sends nothing for 60
// seconds is stopped, a service that never sends its headers is given up after 60 seconds, and
// an error body is read only up to 2 KB, however large the service makes it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointRuntime, type FetchLike } from '../../src/adapters/endpoint-runtime';
import { IDLE_MS } from '../../src/adapters/endpoint-stream';

const encoder = new TextEncoder();
const CONFIG = { url: 'https://api.example.com/v1', model: 'm', apiKey: 'sk-test-0123456789' };
const delta = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

/** A body that sends one piece, then nothing more until it is cancelled. */
function stalled(first: string): { response: Response; cancelled: () => boolean } {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(first));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { response: new Response(body, { status: 200 }), cancelled: () => cancelled };
}

async function connected(chat: () => Promise<Response>): Promise<EndpointRuntime> {
  let first = true;
  const fetchFn: FetchLike = (_url, init) => {
    if (first) {
      first = false;
      return Promise.resolve(new Response('{"data":[]}', { status: 200 }));
    }
    const signal = init.signal;
    return new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason as Error), { once: true });
      void chat().then(resolve, reject);
    });
  };
  const runtime = new EndpointRuntime(CONFIG, fetchFn);
  await runtime.load('m', () => undefined);
  return runtime;
}

const ask = (runtime: EndpointRuntime): Promise<string> =>
  runtime.chat({ messages: [{ role: 'user', content: 'hi' }] });

describe('endpoint limits after the first connection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => vi.useRealTimers());

  it('stops a reply that sends nothing for 60 seconds, and says so', async () => {
    const body = stalled(delta('Hel'));
    const runtime = await connected(() => Promise.resolve(body.response));
    const answer = ask(runtime);
    const caught = answer.catch((error: unknown) => error as Error);
    await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    const error = await caught;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/nothing for 60 seconds/);
    expect(body.cancelled()).toBe(true);
  });

  it('gives up on a service that sends no headers for 60 seconds', async () => {
    const runtime = await connected(() => new Promise<Response>(() => undefined));
    const caught = ask(runtime).catch((error: unknown) => error as Error);
    await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    expect(((await caught) as Error).message).toMatch(/nothing for 60 seconds/);
  });

  it('keeps a slow reply going while pieces keep coming', async () => {
    let push: ((text: string) => void) | undefined;
    let end: (() => void) | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (text) => controller.enqueue(encoder.encode(text));
        end = () => controller.close();
      },
    });
    const runtime = await connected(() => Promise.resolve(new Response(body, { status: 200 })));
    const answer = ask(runtime);
    for (const piece of ['a', 'b', 'c']) {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1_000);
      push?.(delta(piece));
    }
    await vi.advanceTimersByTimeAsync(10);
    push?.('data: [DONE]\n\n');
    end?.();
    expect(await answer).toBe('abc');
  });
});

describe('an error body', () => {
  it('is read only up to 2 KB, and the stream is then cancelled', async () => {
    let sent = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(encoder.encode('x'.repeat(1024)));
      },
      cancel() {
        cancelled = true;
      },
    });
    const runtime = await connected(() => Promise.resolve(new Response(body, { status: 500 })));
    await expect(ask(runtime)).rejects.toThrow(/answered 500/);
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThan(10);
  });
});
