// SPDX-License-Identifier: Apache-2.0
// C01: imperative registration and removal. Chrome 157 has no unregisterTool: a tool goes away
// when the AbortSignal passed to registerTool aborts. Where unregisterTool exists it is tested too.
(function () {
  'use strict';
  const c = window.__conformance;
  const base = (name, extra = {}) => ({
    name,
    description: `Returns the word ${name}.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => name,
    ...extra,
  });

  async function setup(ctx) {
    await ctx.register(base('c01_titled', { title: 'A titled tool' }));
    await ctx.register(base('c01_untitled'));
    await ctx.register(base('c01_removable'));
    ctx.button('Remove c01_removable', 'c01-remove', () => ctx.remove('c01_removable'));
    ctx.button('Add c01_removable again', 'c01-add', () => ctx.register(base('c01_removable')));
  }

  async function abortThenReRegister(ctx) {
    ctx.remove('c01_removable');
    if (!(await ctx.waitFor(async () => !(await ctx.names()).includes('c01_removable')))) {
      return 'aborting the signal did not remove the tool';
    }
    await ctx.register(base('c01_removable'));
    const again = (await ctx.names()).includes('c01_removable');
    return again ? '' : 'the name could not be registered again after removal';
  }

  async function unregisterWhenPresent(ctx) {
    if (typeof ctx.mc.unregisterTool !== 'function')
      return 'no unregisterTool (expected in Chrome 157)';
    await ctx.mc.registerTool(base('c01_unregister_me'));
    await ctx.mc.unregisterTool('c01_unregister_me');
    const gone = !(await ctx.names()).includes('c01_unregister_me');
    return gone ? 'unregisterTool works' : 'unregisterTool did not remove the tool';
  }

  async function check(ctx) {
    const tools = await ctx.tools();
    const titled = tools.find((t) => t.name === 'c01_titled');
    if (titled?.title !== 'A titled tool') return c.result.fail('the title was not returned');
    const problem = await abortThenReRegister(ctx);
    if (problem) return c.result.fail(problem);
    const note = await unregisterWhenPresent(ctx);
    return note.includes('did not') ? c.result.fail(note) : c.result.pass(note);
  }

  c.add({
    id: 'c01',
    title: 'Register, remove and register again',
    summary: 'registerTool with and without a title, removal by AbortSignal, the same name again',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
