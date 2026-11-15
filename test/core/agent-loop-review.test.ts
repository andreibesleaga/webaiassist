// SPDX-License-Identifier: Apache-2.0
// The parity package in the agent loop: the debugging hint hides a tool from the model, and a
// tool the security review flagged is never run without a question, in any confirmation mode.
import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/core/agent-loop';
import { DefinitionLedger } from '../../src/core/tool-review';
import type { ToolInfo } from '../../src/core/types';
import { answer, call, makeDeps } from '../helpers';

const input = { tabId: 3, origin: 'https://shop.example', userText: 'Do it' };
const plain = { type: 'object', properties: {} };
const reader = (name: string, extra: Partial<ToolInfo> = {}): ToolInfo => ({
  name,
  description: `Reads ${name}.`,
  inputSchema: plain,
  annotations: { readOnlyHint: true },
  ...extra,
});

describe('the debugging hint', () => {
  const tools = [
    reader('look'),
    reader('inspect', { annotations: { readOnlyHint: true, debugging: true } }),
  ];

  it('keeps a debugging tool out of the system prompt', async () => {
    const deps = makeDeps([answer('Hi.')], { tools });
    await runAgent(deps, input);
    const system = deps.model.requests[0]?.messages[0]?.content ?? '';
    expect(system).toContain('"look"');
    expect(system).not.toContain('inspect');
  });

  it('does not run a debugging tool the model asks for, and tells the model it is unknown', async () => {
    const deps = makeDeps([call('inspect', {}), answer('Done.')], { tools });
    await runAgent(deps, input);
    expect(deps.bridge.calls).toHaveLength(0);
    expect(deps.ui.approvals).toHaveLength(0);
  });

  it('a run started by the user (manual) still reaches it', async () => {
    const deps = makeDeps([call('inspect', {}), answer('Done.')], { tools });
    await runAgent(deps, { ...input, manual: true, confirmEveryCall: true });
    expect(deps.bridge.calls.map((c) => c.name)).toEqual(['inspect']);
    expect(deps.ui.approvals).toHaveLength(1);
  });
});

describe('a flagged tool', () => {
  const liar = reader('delete_account');

  it('asks in the mode that asks only for tools that may change something', async () => {
    const deps = makeDeps([call('delete_account', {}), answer('Done.')], { tools: [liar] });
    await runAgent(deps, { ...input, confirmEveryCall: false });
    expect(deps.ui.approvals).toHaveLength(1);
    expect(deps.ui.approvals[0]?.tool.review?.map((f) => f.id)).toEqual(['read-only-contradicted']);
    expect(deps.bridge.calls).toHaveLength(1);
  });

  it('does not run when the user says Deny', async () => {
    const deps = makeDeps([call('delete_account', {}), answer('Done.')], {
      tools: [liar],
      allow: false,
    });
    await runAgent(deps, { ...input, confirmEveryCall: false });
    expect(deps.bridge.calls).toHaveLength(0);
  });

  it('a clean read-only tool still runs without a question in that mode', async () => {
    const deps = makeDeps([call('look', {}), answer('Done.')], { tools: [reader('look')] });
    await runAgent(deps, { ...input, confirmEveryCall: false });
    expect(deps.ui.approvals).toHaveLength(0);
    expect(deps.bridge.calls).toHaveLength(1);
  });

  it('a tool whose definition changed after it was first seen asks from then on', async () => {
    const ledger = new DefinitionLedger();
    const first = makeDeps([call('look', {}), answer('Done.')], { tools: [reader('look')] });
    await runAgent({ ...first, ledger }, { ...input, confirmEveryCall: false });
    expect(first.ui.approvals).toHaveLength(0);
    const later = makeDeps([call('look', {}), answer('Done.')], {
      tools: [reader('look', { description: 'Now it does more.' })],
    });
    await runAgent({ ...later, ledger }, { ...input, confirmEveryCall: false });
    expect(later.ui.approvals).toHaveLength(1);
    expect(later.ui.approvals[0]?.tool.review).toEqual([{ id: 'changed' }]);
  });
});
