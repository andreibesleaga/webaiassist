// SPDX-License-Identifier: Apache-2.0
// C14: frames. A same-origin frame registers a tool; a cross-origin frame (a second address of
// this server, passed as ?other=<address of the second host>) registers one with exposedTo and allow="tools".
// The page records what getTools() shows for the top window; it does not decide what is right.
(function () {
  'use strict';
  const c = window.__conformance;

  function frame(ctx, src, allow) {
    const element = document.createElement('iframe');
    element.src = src;
    element.title = 'Conformance frame';
    element.height = 60;
    if (allow) element.setAttribute('allow', allow);
    ctx.stage.append(element);
    return new Promise((resolve) => element.addEventListener('load', resolve, { once: true }));
  }

  async function setup(ctx) {
    await ctx.register({
      name: 'c14_top',
      description: 'The tool of the top window.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => 'from the top window',
    });
    await frame(ctx, 'frames/inner.html?kind=same');
    await ctx.waitFor(async () => (await ctx.names()).includes('c14_inner_same'));
    const other = ctx.param('other');
    ctx.state.other = other;
    if (other) {
      const src = new URL(
        `frames/inner.html?kind=cross&expose=${encodeURIComponent(location.origin)}`,
        other,
      ).href;
      await frame(ctx, src, 'tools');
    }
  }

  async function check(ctx) {
    await ctx.sleep(500);
    const own = await ctx.names();
    if (!own.includes('c14_top')) return c.result.fail('the top tool is missing');
    if (own.includes('c14_inner_cross'))
      return c.result.fail('a cross-origin frame tool shows without fromOrigins');
    const same = own.includes('c14_inner_same') ? 'listed' : 'not listed';
    if (!ctx.state.other) {
      return c.result.unsupported(
        `no ?other= address: cross-origin frame not tested; same-origin frame tool ${same}`,
      );
    }
    const exposed = await ctx.names({ fromOrigins: [new URL(ctx.state.other).origin] });
    const cross = exposed.includes('c14_inner_cross') ? 'listed' : 'not listed';
    return c.result.pass(
      `same-origin frame tool ${same} by default; cross-origin tool ${cross} with fromOrigins`,
    );
  }

  c.add({
    id: 'c14',
    title: 'Frames',
    summary: 'a same-origin frame tool; a cross-origin frame with allow="tools" and exposedTo',
    spec: c.links.secure,
    setup,
    check,
  });
})();
