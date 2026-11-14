// SPDX-License-Identifier: Apache-2.0
// The "use the tools of this site?" question comes when a tool is first about to be used,
// before the question about that one call, and never when the model answers without a tool.
import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/core/agent-loop';
import { answer, call, makeDeps } from '../helpers';

const input = { tabId: 3, origin: 'https://node.example', userText: 'Find review' };

describe('runAgent: site gate', () => {
  it('is not used when the model answers without a tool', async () => {
    const deps = makeDeps([answer('Hello.')]);
    let asked = 0;
    await runAgent(
      { ...deps, siteGate: () => (asked++, Promise.resolve(true)) },
      { ...input, userText: 'Hello' },
    );
    expect(asked).toBe(0);
  });

  it('is asked before the question about the call, then the call runs', async () => {
    const deps = makeDeps([call('propose', { slug: 'a' }), answer('Done.')]);
    const order: string[] = [];
    const confirm = deps.ui.confirmToolCall.bind(deps.ui);
    deps.ui.confirmToolCall = (request) => (order.push('call'), confirm(request));
    await runAgent({ ...deps, siteGate: () => (order.push('site'), Promise.resolve(true)) }, input);
    expect(order).toEqual(['site', 'call']);
    expect(deps.bridge.calls.map((c) => c.name)).toEqual(['propose']);
  });

  it('refuses the call when the site is not allowed: no call question, no call, the model is told', async () => {
    const deps = makeDeps([call('search', { query: 'a' }), answer('No tools.')]);
    const result = await runAgent({ ...deps, siteGate: () => Promise.resolve(false) }, input);
    expect(result.status).toBe('answered');
    expect(deps.ui.approvals).toHaveLength(0);
    expect(deps.bridge.calls).toHaveLength(0);
    expect(deps.model.requests[1]?.messages.at(-1)).toEqual({
      role: 'tool',
      content: 'The user did not allow the tools of this site. "search" was not run.',
    });
  });

  it('runs as before with no gate (a site already allowed)', async () => {
    const deps = makeDeps([call('search', { query: 'a' }), answer('Found.')]);
    await runAgent(deps, input);
    expect(deps.bridge.calls).toHaveLength(1);
  });
});
