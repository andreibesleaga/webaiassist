// SPDX-License-Identifier: Apache-2.0
// The endpoint runtime reads token counts and the price from the reply (streamed form), sends
// no identifying header, and cuts and scrubs the service's own error text.
import { describe, expect, it } from 'vitest';
import { EndpointRuntime, type FetchLike } from '../../src/adapters/endpoint-runtime';
import type { ModelUsage } from '../../src/core/ports/model-runtime';

const encoder = new TextEncoder();
const KEY = 'sk-or-v1-0123456789abcdef0123456789';
const CONFIG = { url: 'https://openrouter.ai/api/v1', model: 'vendor/small', apiKey: KEY };

const event = (value: object): string => `data: ${JSON.stringify(value)}\n\n`;
const delta = (content: string): string => event({ choices: [{ delta: { content } }] });

function sse(pieces: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

interface Seen {
  readonly url: string;
  readonly init: RequestInit;
}

async function connected(replies: Response[], seen: Seen[] = []): Promise<EndpointRuntime> {
  const fetchFn: FetchLike = (url, init) => {
    seen.push({ url, init });
    const reply = replies.shift();
    return reply ? Promise.resolve(reply) : Promise.reject(new TypeError('Failed to fetch'));
  };
  const runtime = new EndpointRuntime(CONFIG, fetchFn);
  await runtime.load('m', () => {});
  return runtime;
}

async function chatUsage(stream: Response): Promise<ModelUsage[]> {
  const runtime = await connected([new Response('{}'), stream]);
  const usages: ModelUsage[] = [];
  await runtime.chat({ messages: [], onUsage: (u) => usages.push(u) });
  return usages;
}

describe('usage from the streamed reply', () => {
  it('reads tokens and the price from the last chunk (OpenRouter form)', async () => {
    const last = event({
      choices: [{ index: 0, delta: { content: '' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138, cost: 0.000042 },
    });
    expect(await chatUsage(sse([delta('hi'), last, 'data: [DONE]\n\n']))).toEqual([
      { promptTokens: 120, completionTokens: 18, costUsd: 0.000042 },
    ]);
  });

  it('reads tokens with no price (Ollama and LM Studio form, empty choices)', async () => {
    const last = event({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } });
    expect(await chatUsage(sse([delta('x'), last, 'data: [DONE]\n\n']))).toEqual([
      { promptTokens: 7, completionTokens: 3 },
    ]);
  });

  it('reports nothing when the service sends no usage, or nonsense', async () => {
    expect(await chatUsage(sse([delta('x'), 'data: [DONE]\n\n']))).toEqual([]);
    const odd = event({ usage: { prompt_tokens: -1, completion_tokens: 'many', cost: 'free' } });
    expect(await chatUsage(sse([delta('x'), odd]))).toEqual([]);
  });

  it('asks for usage in the stream and sends no header that identifies the user or the app', async () => {
    const seen: Seen[] = [];
    const runtime = await connected([new Response('{}'), sse([delta('x')])], seen);
    await runtime.chat({ messages: [] });
    const body = JSON.parse(seen[1]?.init.body as string) as Record<string, unknown>;
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(Object.keys(seen[1]?.init.headers as object).sort()).toEqual([
      'authorization',
      'content-type',
    ]);
  });
});

describe('the service’s own error text is cut and scrubbed', () => {
  it('adds the service message to a refusal, without the key', async () => {
    const body = JSON.stringify({
      error: { message: `No credits left. Authorization: Bearer ${KEY} was used.` },
    });
    const runtime = await connected([new Response('{}'), new Response(body, { status: 402 })]);
    const error = await runtime.chat({ messages: [] }).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/answered 402.*No credits left/);
    expect((error as Error).message).not.toContain(KEY);
    expect((error as Error).message).not.toMatch(/Bearer\s+\S{6,}/);
  });

  it('cuts a long text, ignores HTML and takes plain text as it comes', async () => {
    const long = JSON.stringify({ error: { message: 'x'.repeat(5000) } });
    const runtime = await connected([new Response('{}'), new Response(long, { status: 500 })]);
    const error = (await runtime.chat({ messages: [] }).catch((e: Error) => e)) as Error;
    expect(error.message.length).toBeLessThan(400);
    const html = await connected([
      new Response('{}'),
      new Response('<html><script>alert(1)</script></html>', { status: 502 }),
    ]);
    const second = (await html.chat({ messages: [] }).catch((e: Error) => e)) as Error;
    expect(second.message).toBe('The endpoint answered 502.');
  });

  it('scrubs the key from a failed connection and from an error inside the stream', async () => {
    const echo: FetchLike = () => Promise.reject(new TypeError(`bad header Bearer ${KEY}`));
    const away = new EndpointRuntime(CONFIG, echo);
    const reached = (await away.load('m', () => {}).catch((e: Error) => e)) as Error;
    expect(reached.message).not.toContain(KEY);
    const failing = event({
      error: { code: 502, message: `upstream said key=${KEY}` },
      choices: [{ delta: { content: '' }, finish_reason: 'error' }],
    });
    const runtime = await connected([new Response('{}'), sse([delta('a'), failing])]);
    const error = (await runtime.chat({ messages: [] }).catch((e: Error) => e)) as Error;
    expect(error.message).toMatch(/upstream said/);
    expect(error.message).not.toContain(KEY);
  });
});
