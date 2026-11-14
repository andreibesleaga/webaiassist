// SPDX-License-Identifier: Apache-2.0
// C05: every annotation (readOnlyHint, untrustedContentHint, consequentialHint, debugging), some
// combinations, and a tool with none.
(function () {
  'use strict';
  const c = window.__conformance;
  const make = (name, annotations) => ({
    name,
    description: `Annotated ${name}.`,
    inputSchema: { type: 'object', properties: {} },
    ...(annotations ? { annotations } : {}),
    execute: () => `ran ${name}`,
  });

  const TOOLS = [
    make('c05_read_only', { readOnlyHint: true }),
    make('c05_untrusted', { readOnlyHint: true, untrustedContentHint: true }),
    make('c05_consequential', { consequentialHint: true }),
    make('c05_read_only_and_consequential', { readOnlyHint: true, consequentialHint: true }),
    make('c05_debugging', { readOnlyHint: true, debugging: true }),
    make('c05_all', {
      readOnlyHint: true,
      untrustedContentHint: true,
      consequentialHint: true,
      debugging: true,
    }),
    make('c05_none'),
  ];

  const setup = async (ctx) => {
    for (const tool of TOOLS) await ctx.register(tool);
  };

  /** The hints each tool must report back, as true flags; the browser may add false ones. */
  function wrong(listed, wanted) {
    const given = listed?.annotations ?? {};
    return Object.entries(wanted ?? {}).filter(([key, value]) => given[key] !== value);
  }

  async function check(ctx) {
    const tools = await ctx.tools();
    const bad = [];
    for (const tool of TOOLS) {
      const listed = tools.find((t) => t.name === tool.name);
      if (!listed) bad.push(`${tool.name} missing`);
      else if (wrong(listed, tool.annotations).length) bad.push(`${tool.name} hints differ`);
    }
    if (bad.length) return c.result.fail(bad.join('; '));
    const none = tools.find((t) => t.name === 'c05_none');
    return c.result.pass(
      `a tool with no hints is listed with: ${JSON.stringify(none.annotations ?? null)}`,
    );
  }

  c.add({
    id: 'c05',
    title: 'Annotations',
    summary: 'readOnlyHint, untrustedContentHint, consequentialHint, debugging, combinations, none',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
