// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026: the OpenAI-compatible endpoint runtime.
// A failing test here is an open finding of the review (see the report), not a broken test.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EndpointRuntime,
  endpointUrlProblem,
  type FetchLike,
} from '../../src/adapters/endpoint-runtime';
import { endpointAccess } from '../../src/ui/options-form';

const encoder = new TextEncoder();
const KEY = 'sk-review-0123456789abcdef';
const CONFIG = { url: 'https://llm.example/v1', model: 'm', apiKey: KEY };

const delta = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

function streamOf(count: number, piece: string): Response {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === count) return controller.close();
      sent += 1;
      controller.enqueue(encoder.encode(piece));
    },
  });
  return new Response(body, { status: 200 });
}

async function connected(replies: Response[], seen: RequestInit[] = []) {
  const fetchFn: FetchLike = (_url, init) => {
    seen.push(init);
    const reply = replies.shift();
    return reply ? Promise.resolve(reply) : Promise.reject(new TypeError('Failed to fetch'));
  };
  const runtime = new EndpointRuntime(CONFIG, fetchFn);
  await runtime.load('m', () => {});
  return runtime;
}

describe('finding: the endpoint fetch follows redirects', () => {
  it('asks fetch to refuse a redirect instead of following it', async () => {
    const seen: RequestInit[] = [];
    await connected([new Response('{}')], seen);
    expect(seen[0]?.redirect).toBe('error');
  });
});

describe('finding: an endpoint reply has no size limit', () => {
  it('stops a reply that streams more than 1 MB', async () => {
    const runtime = await connected([new Response('{}'), streamOf(800, delta('x'.repeat(10_000)))]);
    await expect(runtime.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow();
  });
});

describe('finding: endpoint addresses the extension cannot actually reach or should refuse', () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'static', 'manifest.json'), 'utf8'),
  ) as { optional_host_permissions: string[] };

  it('every accepted http address has a matching optional host permission', () => {
    for (const url of [
      'http://localhost:11434/v1',
      'http://127.0.0.1:1234/v1',
      'http://[::1]:8080/v1',
    ]) {
      if (endpointUrlProblem(url) !== undefined) continue;
      expect(manifest.optional_host_permissions).toContain(endpointAccess(url).pattern);
    }
  });

  it('refuses an address with a user name and password in it', () => {
    expect(endpointUrlProblem('https://user:hunter2-secret@llm.example/v1')).toBeDefined();
  });
});

describe('held: endpoint address rules and key handling', () => {
  it.each([
    'http://192.168.1.10/v1',
    'http://localhost.evil.example/v1',
    'http://127.0.0.1.nip.io/v1',
    'ftp://llm.example/v1',
    'javascript:alert(1)',
    'file:///etc/passwd',
  ])('refuses %s', (url) => {
    expect(endpointUrlProblem(url)).toBeDefined();
  });

  it('does not put the key in an error message', async () => {
    const runtime = new EndpointRuntime(CONFIG, () => Promise.reject(new TypeError('boom')));
    await expect(runtime.load('m', () => {})).rejects.toThrow(/could not reach/);
    await runtime
      .load('m', () => {})
      .catch((error: unknown) => {
        expect(String(error)).not.toContain(KEY);
      });
  });

  it('reads a native tool call or a malformed line as no text', async () => {
    const body =
      'data: {not json\n' +
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ id: 'x' }] } }] })}\n` +
      `${delta('{"answer":"ok"}')}data: [DONE]\n${delta('after done')}`;
    const runtime = await connected([new Response('{}'), new Response(body)]);
    expect(await runtime.chat({ messages: [{ role: 'user', content: 'hi' }] })).toBe(
      '{"answer":"ok"}',
    );
  });
});
