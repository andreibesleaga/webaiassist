// SPDX-License-Identifier: Apache-2.0
// C08: cancellation. A tool that honours the signal passed to execute; executeTool with a
// signal; the toolcancel event. The page writes what it saw into #c08-log so an observer (the
// extension run) can read it.
(function () {
  'use strict';
  const c = window.__conformance;

  function waitsFor(signal, ms, log) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve('finished'), ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        log('execute saw the abort');
        reject(signal.reason ?? new Error('aborted'));
      });
    });
  }

  async function setup(ctx) {
    const log = (line) => {
      const out = document.getElementById('c08-log');
      if (out) out.textContent = `${out.textContent} ${line}.`;
    };
    ctx.stage.append(
      Object.assign(document.createElement('p'), { id: 'c08-log', textContent: 'Seen:' }),
    );
    await ctx.register({
      name: 'c08_cancellable',
      description: 'Waits up to ten seconds and stops when it is cancelled.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: (_input, client) =>
        waitsFor(client?.signal ?? new AbortController().signal, 10000, log),
    });
  }

  async function check(ctx) {
    const cancels = [];
    ctx.mc.addEventListener('toolcancel', (event) => cancels.push(event.toolName));
    const controller = new AbortController();
    const call = ctx.run('c08_cancellable', {}, { signal: controller.signal });
    await ctx.sleep(100);
    controller.abort();
    const ended = await call.then(
      () => 'finished',
      (error) => `rejected: ${error?.name}`,
    );
    await ctx.waitFor(() => document.getElementById('c08-log').textContent.includes('abort'), 1000);
    if (ended === 'finished') return c.result.fail('executeTool ignored its signal');
    const seen = document.getElementById('c08-log').textContent.includes('abort');
    if (!seen) return c.result.fail('execute never saw the abort');
    return c.result.pass(`call ended as ${ended}; toolcancel events: ${cancels.length}`);
  }

  c.add({
    id: 'c08',
    title: 'Cancellation',
    summary: 'execute honours its signal; executeTool with a signal; toolcancel',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
