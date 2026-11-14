// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { AjvArgsValidator } from '../../src/adapters/ajv-args-validator';
import { AGSC_TOOLS, tool } from '../helpers';

describe('AjvArgsValidator', () => {
  const validator = new AjvArgsValidator();

  it('accepts arguments that match the schema', () => {
    expect(validator.validate(tool('search').inputSchema ?? {}, { query: 'x' })).toEqual({
      ok: true,
    });
  });

  it('rejects a missing required argument and names it', () => {
    const result = validator.validate(tool('search').inputSchema ?? {}, {});
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('query');
  });

  it('rejects a wrong type', () => {
    expect(validator.validate(tool('brief').inputSchema ?? {}, { selection: 'a' }).ok).toBe(false);
  });

  it('compiles all ten node tool schemas', () => {
    for (const t of AGSC_TOOLS)
      expect(() => validator.validate(t.inputSchema ?? {}, {})).not.toThrow();
  });

  it('reports a schema it cannot compile instead of throwing', () => {
    const result = validator.validate({ type: 'no-such-type' }, {});
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('schema');
  });

  it('reuses the compiled schema for the same object', () => {
    const schema = { type: 'object', required: ['a'] };
    expect(validator.validate(schema, { a: 1 })).toEqual({ ok: true });
    expect(validator.validate(schema, {}).ok).toBe(false);
  });
});
