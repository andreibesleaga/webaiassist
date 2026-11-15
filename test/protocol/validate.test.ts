// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  generateTypesSource,
  generateValidatorSource,
  OUTPUT,
  TYPES_OUTPUT,
} from '../../scripts/gen-validators';
import type { Message } from '../../src/protocol/messages';
import { HOPS } from '../../src/protocol/messages';
import { parseEnvelope, parseMessage } from '../../src/protocol/validate';
import { AGSC_TOOLS } from '../helpers';

const report = {
  available: true,
  adapter: true,
  features: ['shader-f16'],
  limits: { maxBufferSize: 1 },
};

/** One valid sample per message type. */
const SAMPLES: Message[] = [
  { type: 'tools/list', id: 'a1', tabId: 4 },
  { type: 'tools/list-result', id: 'a1', ok: true, tools: AGSC_TOOLS.map((t) => ({ ...t })) },
  {
    type: 'tools/list-result',
    id: 'a3',
    ok: true,
    tools: [],
    origin: 'https://node.example',
    linkset: true,
  },
  { type: 'tools/list-result', id: 'a4', ok: false, tools: [], error: 'x', access: 'denied' },
  { type: 'tools/list-result', id: 'a5', ok: false, tools: [], access: 'restricted' },
  {
    type: 'tools/call',
    id: 'a2',
    origin: 'https://node.example',
    name: 'search',
    args: { query: 'x' },
  },
  { type: 'tools/call-result', id: 'a2', ok: true, text: '{"trust":"untrusted"}' },
  { type: 'tools/cancel', id: 'a2', tabId: 4 },
  { type: 'tools/changed' },
  { type: 'model/load', id: 'm1', modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' },
  { type: 'model/progress', id: 'm1', fraction: 0.5, text: 'half' },
  { type: 'model/load-result', id: 'm1', ok: false, error: 'no WebGPU adapter' },
  { type: 'model/stop', id: 'm2' },
  { type: 'model/cancel', id: 'm1' },
  { type: 'model/chat', id: 'm2', messages: [{ role: 'user', content: 'hi' }] },
  { type: 'model/token', id: 'm2', token: 'h' },
  { type: 'model/chat-result', id: 'm2', ok: true, text: 'hello' },
  { type: 'probe/gpu', id: 'p1', target: 'offscreen' },
  { type: 'probe/gpu-result', id: 'p1', target: 'worker', report },
];

describe('parseMessage', () => {
  it('has one sample for every message type', () => {
    expect(new Set(SAMPLES.map((s) => s.type)).size).toBe(HOPS.panel.length);
  });

  it.each(SAMPLES)('accepts a valid $type on the panel hop', (sample) => {
    expect(parseMessage(sample, 'panel')).toEqual({ ok: true, value: sample });
  });

  it('refuses a model message on the page hop', () => {
    const result = parseMessage({ type: 'model/chat', id: 'x', messages: [] }, 'page');
    expect(result).toEqual({
      ok: false,
      error: 'message type "model/chat" is not allowed on the page hop',
    });
  });

  it('carries model/stop and model/load-result between the panel and the model host', () => {
    expect(parseMessage({ type: 'model/stop', id: 'm' }, 'offscreen').ok).toBe(true);
    expect(parseMessage({ type: 'model/load-result', id: 'm', ok: true }, 'panel').ok).toBe(true);
    expect(parseMessage({ type: 'model/stop', id: 'm' }, 'content').ok).toBe(false);
  });

  it('refuses a page origin that is not an http(s) origin', () => {
    const bad = { type: 'tools/list-result', id: 'x', ok: true, tools: [], origin: 'javascript:1' };
    expect(parseMessage(bad, 'content').ok).toBe(false);
  });

  it('refuses an access value other than denied or restricted', () => {
    const odd = { type: 'tools/list-result', id: 'x', ok: false, tools: [], access: 'granted' };
    expect(parseMessage(odd, 'panel').ok).toBe(false);
  });

  it('refuses a tool message on the offscreen hop', () => {
    expect(parseMessage({ type: 'tools/list', id: 'x' }, 'offscreen').ok).toBe(false);
  });

  it('refuses a value with no type', () => {
    expect(parseMessage(null, 'panel')).toEqual({ ok: false, error: 'not a message' });
    expect(parseMessage({ id: 'x' }, 'panel')).toEqual({ ok: false, error: 'not a message' });
    expect(parseMessage('tools/list', 'panel')).toEqual({ ok: false, error: 'not a message' });
  });

  it('refuses an unknown type', () => {
    expect(parseMessage({ type: 'tools/delete', id: 'x' }, 'panel').ok).toBe(false);
  });

  it('refuses extra fields and says where', () => {
    const result = parseMessage({ type: 'tools/list', id: 'x', script: 'alert(1)' }, 'content');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('additional properties');
  });

  it('refuses a missing field, a wrong type and an over-long id', () => {
    expect(parseMessage({ type: 'tools/call', id: 'x', args: {} }, 'page').ok).toBe(false);
    expect(
      parseMessage({ type: 'tools/call-result', id: 'x', ok: 'yes', text: '' }, 'page').ok,
    ).toBe(false);
    expect(parseMessage({ type: 'tools/list', id: 'x'.repeat(65) }, 'page').ok).toBe(false);
  });

  it('refuses a chat message with an unknown role', () => {
    const bad = { type: 'model/chat', id: 'm', messages: [{ role: 'root', content: 'x' }] };
    expect(parseMessage(bad, 'offscreen').ok).toBe(false);
  });
});

describe('parseEnvelope', () => {
  const channel = 'c0ffee00-1234-4abc-8def-0123456789ab';

  it('accepts a page message from this extension on a valid channel', () => {
    const envelope = { source: 'webaiassist', channel, message: { type: 'tools/changed' } };
    expect(parseEnvelope(envelope)).toEqual({ ok: true, value: envelope });
  });

  it('refuses another source, a short channel or a missing message', () => {
    expect(parseEnvelope({ source: 'page', channel, message: {} }).ok).toBe(false);
    expect(parseEnvelope({ source: 'webaiassist', channel: 'abc', message: {} }).ok).toBe(false);
    expect(parseEnvelope({ source: 'webaiassist', channel }).ok).toBe(false);
  });
});

describe('generated validators', () => {
  it('match the schemas (run npm run gen:validators if this fails)', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(generateValidatorSource());
    expect(readFileSync(TYPES_OUTPUT, 'utf8')).toBe(generateTypesSource());
  });

  it('need no eval and no runtime require', () => {
    const source = readFileSync(OUTPUT, 'utf8');
    expect(source).not.toMatch(/require\(|new Function|eval\(/);
  });
});
