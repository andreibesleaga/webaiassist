// SPDX-License-Identifier: Apache-2.0
// C04: toolchange, ontoolactivated, ontoolcancel on document.modelContext.
(function () {
  'use strict';
  const c = window.__conformance;
  const probe = (name) => ({
    name,
    description: `Probe ${name}.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => name,
  });

  async function setup(ctx) {
    await ctx.register(probe('c04_keeper'));
    ctx.button('Add c04_extra', 'c04-add', () => ctx.register(probe('c04_extra')));
    ctx.button('Remove c04_extra', 'c04-remove', () => ctx.remove('c04_extra'));
  }

  async function check(ctx) {
    const counts = { change: 0, activated: [], cancel: [] };
    ctx.mc.addEventListener('toolchange', () => counts.change++);
    ctx.mc.addEventListener('toolactivated', (e) => counts.activated.push(e.toolName));
    ctx.mc.addEventListener('toolcancel', (e) => counts.cancel.push(e.toolName));
    await ctx.register(probe('c04_extra'));
    await ctx.waitFor(() => counts.change >= 1);
    const afterAdd = counts.change;
    ctx.remove('c04_extra');
    await ctx.waitFor(() => counts.change > afterAdd);
    await ctx.run('c04_keeper');
    await ctx.sleep(100);
    if (afterAdd < 1) return c.result.fail('no toolchange after adding a tool');
    if (counts.change <= afterAdd) return c.result.fail('no toolchange after removing a tool');
    const handlers = ['ontoolchange', 'ontoolactivated', 'ontoolcancel'].filter(
      (n) => !(n in ctx.mc),
    );
    if (handlers.length) return c.result.fail(`missing handler properties: ${handlers.join(', ')}`);
    return c.result.pass(
      `toolchange ${counts.change}x; toolactivated for: ${counts.activated.join(',') || 'nothing'}`,
    );
  }

  c.add({
    id: 'c04',
    title: 'Tool-change events',
    summary: 'toolchange when a tool is added and removed; toolactivated and toolcancel handlers',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
