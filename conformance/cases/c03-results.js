// SPDX-License-Identifier: Apache-2.0
// C03: the forms of a result: a string, a JSON text, an object, an empty string, and null when the
// call navigates the page (the navigating tool is called only by the extension run).
(function () {
  'use strict';
  const c = window.__conformance;
  const none = { type: 'object', properties: {} };
  const tool = (name, execute) => ({
    name,
    description: `Result form ${name}.`,
    inputSchema: none,
    annotations: { readOnlyHint: true },
    execute,
  });

  async function setup(ctx) {
    await ctx.register(tool('c03_string', () => 'hello'));
    await ctx.register(tool('c03_json_string', () => '{"a":1}'));
    await ctx.register(tool('c03_object', () => ({ a: 1, list: [1, 2] })));
    await ctx.register(tool('c03_empty', () => ''));
    await ctx.register(tool('c03_null', () => null));
    await ctx.register(tool('c03_number', () => 5));
    await ctx.register(
      tool('c03_navigate', () => {
        setTimeout(() => location.assign('?case=c03&navigated=1'), 0);
        return new Promise(() => {});
      }),
    );
  }

  async function check(ctx) {
    const seen = {
      string: await ctx.run('c03_string'),
      json: await ctx.run('c03_json_string'),
      object: await ctx.run('c03_object'),
      empty: await ctx.run('c03_empty'),
      nothing: await ctx.run('c03_null'),
      number: await ctx.run('c03_number'),
    };
    const wrong = [];
    if (seen.string !== 'hello') wrong.push('string');
    if (seen.json !== '{"a":1}') wrong.push('json string');
    if (typeof seen.empty !== 'string') wrong.push('empty string');
    if (seen.number !== '5') wrong.push('number');
    if (typeof seen.object !== 'string' || !seen.object.includes('"list"')) wrong.push('object');
    if (wrong.length) return c.result.fail(`wrong result for: ${wrong.join(', ')}`);
    return c.result.pass(
      `object came back as ${typeof seen.object}: ${String(seen.object).slice(0, 40)}; an empty string came back as ${JSON.stringify(seen.empty)}, null as ${JSON.stringify(seen.nothing)}; c03_navigate is run by the extension stage only`,
    );
  }

  c.add({
    id: 'c03',
    title: 'Result forms',
    summary: 'string, JSON text, object, empty string, and null after a navigation',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
