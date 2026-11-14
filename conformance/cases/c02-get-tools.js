// SPDX-License-Identifier: Apache-2.0
// C02: getTools(): same-origin default, fromOrigins, and the fields of each entry.
(function () {
  'use strict';
  const c = window.__conformance;

  function setup(ctx) {
    return ctx.register({
      name: 'c02_inspect',
      title: 'Inspect me',
      description: 'A tool whose listed fields are checked.',
      inputSchema: {
        type: 'object',
        properties: { word: { type: 'string', description: 'Any word.' } },
        required: ['word'],
      },
      annotations: { readOnlyHint: true },
      execute: ({ word }) => `got ${word}`,
    });
  }

  function problems(tool) {
    const found = [];
    if (tool.description !== 'A tool whose listed fields are checked.') found.push('description');
    if (tool.title !== 'Inspect me') found.push('title');
    if (typeof tool.inputSchema !== 'object' || tool.inputSchema?.required?.[0] !== 'word')
      found.push('inputSchema');
    if (tool.annotations?.readOnlyHint !== true) found.push('annotations');
    if (tool.origin !== location.origin) found.push(`origin ${tool.origin}`);
    return found;
  }

  async function check(ctx) {
    const tool = await ctx.tool('c02_inspect');
    if (!tool) return c.result.fail('c02_inspect is not listed');
    const wrong = problems(tool);
    if (wrong.length) return c.result.fail(`wrong fields: ${wrong.join(', ')}`);
    const named = await ctx.names({ fromOrigins: [location.origin] });
    if (!named.includes('c02_inspect'))
      return c.result.fail('fromOrigins with this origin hides the tool');
    const elsewhere = (await ctx.names({ fromOrigins: ['https://example.invalid'] })).includes(
      'c02_inspect',
    );
    return c.result.pass(
      `fields: ${Object.keys(tool).sort().join(', ')}; own tool with a foreign fromOrigins: ${elsewhere ? 'still listed (the list adds origins)' : 'hidden'}`,
    );
  }

  c.add({
    id: 'c02',
    title: 'getTools and the fields of a tool',
    summary: 'name, title, description, inputSchema, annotations, origin; fromOrigins',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
