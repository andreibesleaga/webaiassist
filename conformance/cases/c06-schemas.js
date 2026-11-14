// SPDX-License-Identifier: Apache-2.0
// C06: input schemas of every JSON type, required and optional fields, no schema. Each tool
// returns its arguments as JSON text, so a caller sees what the page received.
(function () {
  'use strict';
  const c = window.__conformance;
  const prop = (type, extra = {}) => ({
    type: 'object',
    properties: { value: { type, ...extra } },
    required: ['value'],
  });
  const echo = (args) => JSON.stringify(args);

  const SCHEMAS = {
    c06_string: prop('string'),
    c06_number: prop('number'),
    c06_integer: prop('integer'),
    c06_boolean: prop('boolean'),
    c06_array: prop('array', { items: { type: 'string' } }),
    c06_object: prop('object', { properties: { inner: { type: 'string' } } }),
    c06_enum: prop('string', { enum: ['red', 'green', 'blue'] }),
    c06_one_of: {
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { const: 'small', title: 'Small' },
            { const: 'large', title: 'Large' },
          ],
        },
      },
      required: ['value'],
    },
    c06_nested: {
      type: 'object',
      properties: {
        order: {
          type: 'object',
          properties: {
            lines: {
              type: 'array',
              items: {
                type: 'object',
                properties: { sku: { type: 'string' }, qty: { type: 'integer' } },
                required: ['sku'],
              },
            },
          },
          required: ['lines'],
        },
      },
      required: ['order'],
    },
    c06_optional: {
      type: 'object',
      properties: { must: { type: 'string' }, may: { type: 'string' } },
      required: ['must'],
    },
    c06_strict: {
      type: 'object',
      properties: { only: { type: 'string' } },
      additionalProperties: false,
    },
  };

  async function setup(ctx) {
    for (const [name, inputSchema] of Object.entries(SCHEMAS)) {
      await ctx.register({
        name,
        description: `Schema case ${name}; returns its arguments.`,
        inputSchema,
        annotations: { readOnlyHint: true },
        execute: echo,
      });
    }
    await ctx.register({
      name: 'c06_no_schema',
      description: 'A tool with no input schema at all.',
      annotations: { readOnlyHint: true },
      execute: () => 'no schema',
    });
  }

  const VALID = {
    c06_string: { value: 'text' },
    c06_number: { value: 1.5 },
    c06_integer: { value: 3 },
    c06_boolean: { value: true },
    c06_array: { value: ['a', 'b'] },
    c06_object: { value: { inner: 'x' } },
    c06_enum: { value: 'green' },
    c06_one_of: { value: 'large' },
    c06_nested: { order: { lines: [{ sku: 'A1', qty: 2 }] } },
    c06_optional: { must: 'yes' },
    c06_strict: { only: 'ok' },
  };

  async function check(ctx) {
    const bad = [];
    for (const [name, args] of Object.entries(VALID)) {
      const got = await ctx.run(name, args).catch((e) => ctx.text(e));
      if (got !== echo(args)) bad.push(`${name}: ${String(got).slice(0, 60)}`);
    }
    if ((await ctx.run('c06_no_schema')) !== 'no schema') bad.push('c06_no_schema');
    const listed = await ctx.tool('c06_no_schema');
    if (bad.length) return c.result.fail(bad.join('; '));
    return c.result.pass(
      `no-schema tool is listed with inputSchema ${JSON.stringify(listed.inputSchema ?? null)}`,
    );
  }

  c.add({
    id: 'c06',
    title: 'Input schemas',
    summary:
      'string, number, integer, boolean, array, object, nested, enum, oneOf with const, required, additionalProperties false, none',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
