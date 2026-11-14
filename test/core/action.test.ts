// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { ACTION_SCHEMA, actionSchema, parseAction } from '../../src/core/action';

describe('parseAction', () => {
  it('reads a final answer', () => {
    expect(parseAction('{"answer":"Paris"}')).toEqual({
      ok: true,
      action: { kind: 'answer', text: 'Paris' },
    });
  });

  it('reads a tool call with arguments', () => {
    expect(parseAction('{"tool":"search","arguments":{"query":"x"}}')).toEqual({
      ok: true,
      action: { kind: 'call', tool: 'search', args: { query: 'x' } },
    });
  });

  it('treats a tool call without arguments as empty arguments', () => {
    expect(parseAction('{"tool":"check"}')).toEqual({
      ok: true,
      action: { kind: 'call', tool: 'check', args: {} },
    });
  });

  it('accepts JSON inside a fenced block with text around it', () => {
    const reply = 'Here:\n```json\n{"answer":"ok"}\n```\n';
    expect(parseAction(reply)).toEqual({ ok: true, action: { kind: 'answer', text: 'ok' } });
  });

  it('rejects text with no JSON object', () => {
    expect(parseAction('I will search now.')).toEqual({
      ok: false,
      reason: 'no JSON object in the reply',
    });
  });

  it('rejects broken JSON', () => {
    expect(parseAction('{"tool": "search", ')).toMatchObject({ ok: false });
    expect(parseAction('{"tool": search}')).toEqual({
      ok: false,
      reason: 'the reply is not valid JSON',
    });
  });

  it('rejects an object that is neither an answer nor a tool call', () => {
    expect(parseAction('{"thought":"hm"}')).toEqual({
      ok: false,
      reason: 'the JSON has neither "answer" nor "tool"',
    });
  });

  it('rejects arguments that are not an object', () => {
    expect(parseAction('{"tool":"search","arguments":"x"}')).toEqual({
      ok: false,
      reason: '"arguments" must be a JSON object',
    });
    expect(parseAction('{"tool":"search","arguments":[1]}')).toMatchObject({ ok: false });
  });

  it('reads the one object out of a wrapping array, as it does out of any text', () => {
    expect(parseAction('[{"answer":"x"}]')).toEqual({
      ok: true,
      action: { kind: 'answer', text: 'x' },
    });
  });
});

describe('ACTION_SCHEMA', () => {
  const accepts = new Ajv({ strict: false }).compile(ACTION_SCHEMA);

  it('accepts exactly the two shapes parseAction reads', () => {
    expect(accepts({ answer: 'hi' })).toBe(true);
    expect(accepts({ tool: 'add', arguments: { a: 1 } })).toBe(true);
    expect(accepts({ tool: 'ping' })).toBe(true);
  });

  it('refuses a reply that mixes the shapes, has neither, or has other keys', () => {
    expect(accepts({ answer: 'hi', tool: 'add' })).toBe(false);
    expect(accepts({})).toBe(false);
    expect(accepts({ answer: 'hi', note: 'x' })).toBe(false);
    expect(accepts({ tool: 'add', arguments: 'x' })).toBe(false);
  });

  it('describes a JSON object at the top and in each branch (what a constrained decoder needs)', () => {
    expect(ACTION_SCHEMA.type).toBe('object');
    for (const branch of ACTION_SCHEMA.oneOf as { type?: string }[]) {
      expect(branch.type).toBe('object');
    }
  });
});

describe('actionSchema', () => {
  it('lets the model name only the tools it was given', () => {
    const accepts = new Ajv({ strict: false }).compile(actionSchema(['add', 'echo']));
    expect(accepts({ tool: 'add', arguments: { a: 1 } })).toBe(true);
    expect(accepts({ tool: 'delete_everything' })).toBe(false);
    expect(accepts({ answer: 'hi' })).toBe(true);
  });

  it('allows only an answer when the page has no tool to offer', () => {
    const accepts = new Ajv({ strict: false }).compile(actionSchema([]));
    expect(accepts({ answer: 'hi' })).toBe(true);
    expect(accepts({ tool: 'add' })).toBe(false);
  });
});
