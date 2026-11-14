// SPDX-License-Identifier: Apache-2.0
// F20.10: when the run is stopped (the panel closed) while the model is answering, the tool the
// reply asks for is neither confirmed nor called.
import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/core/agent-loop';
import { call, makeDeps } from '../helpers';

const input = { tabId: 3, origin: 'https://node.example', userText: 'Read the guide' };

describe('runAgent: a stopped run', () => {
  it('makes no tool call and asks no question when it is stopped during the model reply', async () => {
    const controller = new AbortController();
    const deps = makeDeps([call('read', { slug: 'a' })], { allow: true });
    const chat = deps.model.chat.bind(deps.model);
    deps.model.chat = async (request) => {
      const reply = await chat(request);
      controller.abort();
      return reply;
    };
    const result = await runAgent(deps, { ...input, signal: controller.signal });
    expect(result.status).toBe('stopped');
    expect(deps.bridge.calls).toHaveLength(0);
    expect(deps.ui.approvals).toHaveLength(0);
  });
});
