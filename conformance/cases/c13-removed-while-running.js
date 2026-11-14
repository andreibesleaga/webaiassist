// SPDX-License-Identifier: Apache-2.0
// C13: a tool removed while its call runs. Chrome 153 and later: the running call is not broken.
(function () {
  'use strict';
  const c = window.__conformance;

  async function setup(ctx) {
    await ctx.register({
      name: 'c13_keeper',
      description: 'A tool that stays.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => 'kept',
    });
    await ctx.register({
      name: 'c13_removes_itself',
      description: 'Removes its own registration while it runs, then answers.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        ctx.remove('c13_removes_itself');
        await ctx.sleep(200);
        return 'finished after removal';
      },
    });
  }

  async function check(ctx) {
    const result = await ctx.run('c13_removes_itself').catch((error) => `error ${ctx.text(error)}`);
    if (result !== 'finished after removal')
      return c.result.fail(`the running call was broken: ${result}`);
    const names = await ctx.names();
    if (names.includes('c13_removes_itself'))
      return c.result.fail('the tool is still listed after removal');
    return c.result.pass('the call finished and the tool left the list');
  }

  c.add({
    id: 'c13',
    title: 'Tool removed while a call runs',
    summary: 'a tool removes its own registration during execute',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
