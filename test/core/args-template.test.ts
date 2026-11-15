// SPDX-License-Identifier: Apache-2.0
// The starting text of the "run it by hand" box: the required fields with an empty value of their type.
import { describe, expect, it } from 'vitest';
import { argsTemplate } from '../../src/core/args-template';

describe('argsTemplate', () => {
  it('gives {} for no schema, no properties or a schema that is not an object', () => {
    expect(argsTemplate(undefined)).toBe('{}');
    expect(argsTemplate({ type: 'object' })).toBe('{}');
    expect(argsTemplate({ properties: 'x' })).toBe('{}');
  });

  it('lists only the required fields, with the default of their type', () => {
    const schema = {
      type: 'object',
      required: ['q', 'n', 'flag', 'tags', 'where', 'odd'],
      properties: {
        q: { type: 'string' },
        n: { type: 'integer' },
        flag: { type: 'boolean' },
        tags: { type: 'array' },
        where: { type: 'object' },
        odd: {},
        optional: { type: 'string' },
      },
    };
    expect(JSON.parse(argsTemplate(schema))).toEqual({
      q: '',
      n: 0,
      flag: false,
      tags: [],
      where: {},
      odd: null,
    });
  });

  it('uses the first enum value and ignores a required name that has no property', () => {
    const schema = {
      required: ['size', 'ghost'],
      properties: { size: { type: 'string', enum: ['small', 'large'] } },
    };
    expect(JSON.parse(argsTemplate(schema))).toEqual({ size: 'small' });
  });

  it('is bounded: at most 20 fields', () => {
    const names = Array.from({ length: 50 }, (_, i) => `f${i}`);
    const properties = Object.fromEntries(names.map((n) => [n, { type: 'string' }]));
    const out = JSON.parse(argsTemplate({ required: names, properties })) as object;
    expect(Object.keys(out)).toHaveLength(20);
  });
});
