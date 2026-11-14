// SPDX-License-Identifier: Apache-2.0
// C10: large results: 1 KB, 100 KB and 1 MB strings, and a deeply nested object.
(function () {
  'use strict';
  const c = window.__conformance;
  const none = { type: 'object', properties: {} };
  const text = (size) => 'x'.repeat(size);
  const deep = (levels) => {
    let value = 'bottom';
    for (let i = 0; i < levels; i++) value = { next: value };
    return value;
  };
  const SIZES = { c10_1kb: 1024, c10_100kb: 102400, c10_1mb: 1048576 };

  async function setup(ctx) {
    for (const [name, size] of Object.entries(SIZES)) {
      await ctx.register({
        name,
        description: `Returns ${size} characters.`,
        inputSchema: none,
        annotations: { readOnlyHint: true },
        execute: () => text(size),
      });
    }
    await ctx.register({
      name: 'c10_deep',
      description: 'Returns an object nested 100 levels deep.',
      inputSchema: none,
      annotations: { readOnlyHint: true },
      execute: () => deep(100),
    });
  }

  async function check(ctx) {
    const bad = [];
    for (const [name, size] of Object.entries(SIZES)) {
      const got = await ctx.run(name);
      if (got?.length !== size) bad.push(`${name} gave ${got?.length} characters`);
    }
    const nested = await ctx.run('c10_deep');
    if (typeof nested !== 'string' || !nested.includes('bottom'))
      bad.push('c10_deep lost its content');
    return bad.length
      ? c.result.fail(bad.join('; '))
      : c.result.pass(`nested object came back as ${nested.length} characters`);
  }

  c.add({
    id: 'c10',
    title: 'Large results',
    summary: '1 KB, 100 KB and 1 MB strings; a deeply nested object',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
