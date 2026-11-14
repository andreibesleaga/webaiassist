// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  apiMembers,
  errorText,
  findModelContext,
  readTools,
  tryExecute,
} from '../../src/adapters/webmcp-reader';

const registered = [
  {
    name: 'search',
    title: '',
    description: 'Search',
    origin: 'https://node.example',
    inputSchema: { type: 'object' },
    annotations: { readOnlyHint: true, untrustedContentHint: true, consequentialHint: false },
  },
  { name: 'old', description: 'Old style', inputSchema: '{"type":"object"}' },
];

describe('findModelContext', () => {
  it('prefers document.modelContext', () => {
    const doc = { modelContext: { getTools: () => [] } };
    expect(findModelContext(doc, { modelContext: {} })).toEqual({
      where: 'document',
      context: doc.modelContext,
    });
  });

  it('falls back to navigator.modelContext', () => {
    const nav = { modelContext: { registerTool: () => undefined } };
    expect(findModelContext({}, nav)).toEqual({ where: 'navigator', context: nav.modelContext });
  });

  it('reports none when neither exists', () => {
    expect(findModelContext(undefined, null)).toEqual({ where: 'none' });
  });
});

describe('apiMembers', () => {
  it('lists the known members present, own or inherited', () => {
    class Ctx {
      registerTool(): void {}
      getTools(): void {}
    }
    const ctx = Object.assign(new Ctx(), { provideContext: () => undefined, ontoolchange: null });
    expect(apiMembers(ctx)).toEqual(['registerTool', 'getTools', 'provideContext', 'ontoolchange']);
  });
});

describe('readTools', () => {
  it('summarises the registered tools', async () => {
    const result = await readTools({ getTools: () => Promise.resolve(registered) });
    expect(result).toEqual({
      ok: true,
      raw: registered,
      tools: [
        {
          name: 'search',
          origin: 'https://node.example',
          schema: 'object',
          hints: ['readOnlyHint', 'untrustedContentHint'],
        },
        { name: 'old', schema: 'string', hints: [] },
      ],
    });
  });

  it('accepts a synchronous array and reports a missing schema', async () => {
    const result = await readTools({ getTools: () => [{ name: 'x', description: 'x' }] });
    expect(result).toMatchObject({ ok: true, tools: [{ name: 'x', schema: 'none', hints: [] }] });
  });

  it('reports a missing getTools', async () => {
    expect(await readTools({})).toEqual({ ok: false, error: 'getTools() is not available' });
  });

  it('reports a result that is not a list', async () => {
    expect(await readTools({ getTools: () => Promise.resolve({}) })).toEqual({
      ok: false,
      error: 'getTools() did not return a list',
    });
  });

  it('reports a thrown DOMException-like error by name', async () => {
    const error = Object.assign(new Error('not allowed'), { name: 'NotAllowedError' });
    expect(await readTools({ getTools: () => Promise.reject(error) })).toEqual({
      ok: false,
      error: 'NotAllowedError: not allowed',
    });
  });

  it('skips list entries without a name', async () => {
    const result = await readTools({ getTools: () => [null, 3, { description: 'x' }] });
    expect(result).toMatchObject({ ok: true, tools: [] });
  });
});

describe('tryExecute', () => {
  it('runs a tool and previews a string result', async () => {
    const ctx = {
      executeTool: (_t: unknown, input?: object) =>
        Promise.resolve(JSON.stringify({ echo: input })),
    };
    expect(await tryExecute(ctx, registered[0], { query: 'x' })).toEqual({
      ok: true,
      type: 'string',
      preview: '{"echo":{"query":"x"}}',
    });
  });

  it('previews a non-string result as JSON and cuts it at 300 characters', async () => {
    const ctx = { executeTool: () => Promise.resolve({ text: 'y'.repeat(400) }) };
    const result = await tryExecute(ctx, registered[0], {});
    expect(result).toMatchObject({ ok: true, type: 'object' });
    expect(result.ok && result.preview.length).toBe(300);
  });

  it('reports a missing executeTool and a thrown error', async () => {
    expect(await tryExecute({}, registered[0], {})).toEqual({
      ok: false,
      error: 'executeTool() is not available',
    });
    const ctx = {
      executeTool: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotFoundError' })),
    };
    expect(await tryExecute(ctx, registered[0], {})).toEqual({
      ok: false,
      error: 'NotFoundError: no',
    });
  });
});

describe('errorText', () => {
  it('writes non-Error values as text', () => {
    expect(errorText('plain')).toBe('plain');
    expect(errorText(42)).toBe('42');
  });
});
