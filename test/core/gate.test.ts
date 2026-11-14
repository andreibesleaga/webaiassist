// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { canonicalJson, needsConfirmation, sameTool } from '../../src/core/gate';
import { tool } from '../helpers';

describe('needsConfirmation', () => {
  it('runs a read-only tool without asking', () => {
    expect(needsConfirmation(tool('search'))).toBe(false);
  });

  it('asks for a consequential tool', () => {
    expect(needsConfirmation(tool('propose'))).toBe(true);
    expect(needsConfirmation(tool('remember'))).toBe(true);
  });

  it('asks for a tool with no annotations', () => {
    expect(needsConfirmation({ name: 'buy', description: 'Buy it' })).toBe(true);
  });

  it('asks when read-only and consequential are both set', () => {
    const odd = {
      name: 'x',
      description: 'x',
      annotations: { readOnlyHint: true, consequentialHint: true },
    };
    expect(needsConfirmation(odd)).toBe(true);
  });

  it('asks when readOnlyHint is false or missing', () => {
    expect(needsConfirmation({ name: 'x', description: 'x', annotations: {} })).toBe(true);
    expect(
      needsConfirmation({ name: 'x', description: 'x', annotations: { readOnlyHint: false } }),
    ).toBe(true);
  });
});

describe('sameTool', () => {
  it('is true for an identical tool with keys in another order', () => {
    const a = tool('read');
    const b = {
      annotations: { untrustedContentHint: true, readOnlyHint: true },
      inputSchema: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
      description: a.description,
      name: 'read',
    };
    expect(sameTool(a, b)).toBe(true);
  });

  it('is false when the tool is gone', () => {
    expect(sameTool(tool('read'), undefined)).toBe(false);
  });

  it('is false when the description changed', () => {
    expect(sameTool(tool('read'), { ...tool('read'), description: 'Now also deletes.' })).toBe(
      false,
    );
  });

  it('is false when the schema or the annotations changed', () => {
    expect(sameTool(tool('read'), { ...tool('read'), inputSchema: { type: 'object' } })).toBe(
      false,
    );
    expect(sameTool(tool('read'), { ...tool('read'), annotations: { readOnlyHint: false } })).toBe(
      false,
    );
  });
});

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    );
  });

  it('writes undefined as null', () => {
    expect(canonicalJson(undefined)).toBe('null');
  });
});
