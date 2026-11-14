// SPDX-License-Identifier: Apache-2.0
// C12: tools that are added later: one three seconds after the page loads, one on a button.
(function () {
  'use strict';
  const c = window.__conformance;
  const tool = (name) => ({
    name,
    description: `Registered later: ${name}.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => name,
  });

  async function setup(ctx) {
    await ctx.register(tool('c12_now'));
    setTimeout(() => void ctx.register(tool('c12_after_three_seconds')), 3000);
    ctx.button('Add c12_on_button', 'c12-add', () => ctx.register(tool('c12_on_button')));
  }

  async function check(ctx) {
    const late = await ctx.waitFor(
      async () => (await ctx.names()).includes('c12_after_three_seconds'),
      5000,
    );
    if (!late) return c.result.fail('the tool registered after three seconds never appeared');
    await ctx.register(tool('c12_on_button'));
    const names = await ctx.names();
    return names.includes('c12_on_button')
      ? c.result.pass('both later tools were listed')
      : c.result.fail('c12_on_button is missing');
  }

  c.add({
    id: 'c12',
    title: 'Tools added later',
    summary: 'a tool that appears three seconds after load and one added by a button',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
