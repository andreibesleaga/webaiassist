// SPDX-License-Identifier: Apache-2.0
// C09: slow tools: two seconds, thirty seconds that honour the signal, thirty seconds that ignore it.
(function () {
  'use strict';
  const c = window.__conformance;
  const none = { type: 'object', properties: {} };

  const later = (ms, value, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(value), ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error('aborted'));
      });
    });

  async function setup(ctx) {
    const base = { inputSchema: none, annotations: { readOnlyHint: true } };
    await ctx.register({
      ...base,
      name: 'c09_two_seconds',
      description: 'Answers after two seconds.',
      execute: () => later(2000, 'two seconds'),
    });
    await ctx.register({
      ...base,
      name: 'c09_thirty_honours',
      description: 'Answers after thirty seconds and stops when cancelled.',
      execute: (_i, client) => later(30000, 'thirty seconds', client?.signal),
    });
    await ctx.register({
      ...base,
      name: 'c09_thirty_ignores',
      description: 'Answers after thirty seconds and ignores cancelling.',
      execute: () => later(30000, 'thirty seconds'),
    });
  }

  async function check(ctx) {
    const began = performance.now();
    const quick = await ctx.run('c09_two_seconds');
    const took = performance.now() - began;
    if (quick !== 'two seconds' || took < 1900)
      return c.result.fail(`two-second tool gave ${quick} after ${Math.round(took)} ms`);
    const controller = new AbortController();
    const honours = ctx.run('c09_thirty_honours', {}, { signal: controller.signal });
    await ctx.sleep(100);
    controller.abort();
    const ended = await honours.then(
      () => 'finished',
      () => 'rejected',
    );
    if (ended !== 'rejected')
      return c.result.fail('the tool that honours the signal was not cancelled');
    const second = new AbortController();
    const ignoring = ctx.run('c09_thirty_ignores', {}, { signal: second.signal });
    await ctx.sleep(100);
    second.abort();
    const result = await Promise.race([
      ignoring.then(
        () => 'finished',
        () => 'rejected',
      ),
      ctx.sleep(1500).then(() => 'still waiting'),
    ]);
    return c.result.pass(`aborting a tool that ignores the signal: ${result}`);
  }

  c.add({
    id: 'c09',
    title: 'Slow tools',
    summary: 'two seconds; thirty seconds honouring the signal; thirty seconds ignoring it',
    spec: c.links.imperative,
    setup,
    check,
  });
})();
