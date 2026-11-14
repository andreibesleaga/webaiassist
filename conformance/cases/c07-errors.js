// SPDX-License-Identifier: Apache-2.0
// C07: tool errors: a thrown Error, a rejected promise, a thrown string, an instant return, a
// duplicate name (InvalidStateError) and a tool that is not registered.
(function () {
  'use strict';
  const c = window.__conformance;
  const tool = (name, execute) => ({
    name,
    description: `Error case ${name}.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute,
  });

  async function setup(ctx) {
    await ctx.register(
      tool('c07_throw_error', () => {
        throw new Error('boom from c07');
      }),
    );
    await ctx.register(tool('c07_reject', () => Promise.reject(new Error('rejected from c07'))));
    await ctx.register(
      tool('c07_throw_string', () => {
        throw 'plain string from c07';
      }),
    );
    await ctx.register(tool('c07_instant', () => 'instant'));
  }

  /** What a call to `name` ends with: its result or the text of its error. */
  async function outcome(ctx, name) {
    try {
      return `ok:${await ctx.run(name)}`;
    } catch (error) {
      return `error:${ctx.text(error)}`;
    }
  }

  async function duplicate(ctx) {
    try {
      await ctx.mc.registerTool(tool('c07_reject', () => 'again'));
      return 'a duplicate name was accepted';
    } catch (error) {
      return error.name === 'InvalidStateError' ? '' : `duplicate gave ${ctx.text(error)}`;
    }
  }

  async function check(ctx) {
    const seen = {};
    for (const name of ['c07_throw_error', 'c07_reject', 'c07_throw_string', 'c07_instant'])
      seen[name] = await outcome(ctx, name);
    const bad = [];
    if (!seen.c07_throw_error.startsWith('error:')) bad.push('a thrown Error did not reject');
    if (!seen.c07_reject.startsWith('error:')) bad.push('a rejected promise did not reject');
    if (!seen.c07_throw_string.startsWith('error:')) bad.push('a thrown string did not reject');
    if (seen.c07_instant !== 'ok:instant') bad.push('the instant tool failed');
    const stale = await ctx.tool('c07_instant');
    ctx.remove('c07_instant');
    await ctx.waitFor(async () => !(await ctx.names()).includes('c07_instant'));
    const unknown = await ctx.mc.executeTool(stale, {}).then(
      () => 'ran',
      () => 'rejected',
    );
    if (unknown !== 'rejected') bad.push('a removed tool still ran');
    const dup = await duplicate(ctx);
    if (dup) bad.push(dup);
    if (bad.length) return c.result.fail(bad.join('; '));
    return c.result.pass(`errors surface as: ${seen.c07_throw_error}`);
  }

  c.add({
    id: 'c07',
    title: 'Tool errors',
    summary:
      'thrown Error, rejected promise, thrown string, instant return, duplicate name, unknown tool',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
