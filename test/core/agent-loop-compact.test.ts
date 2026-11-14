// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/core/agent-loop';
import { compactBudget } from '../../src/core/compact-prompt';
import { estimateTokens, usableContext } from '../../src/core/history';
import type { ModelCapabilities } from '../../src/core/ports/model-runtime';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { answer, makeDeps } from '../helpers';

const input = { tabId: 7, origin: 'https://node.example', userText: 'What can I do here?' };

function small(capabilities: Partial<ModelCapabilities>): FakeModelRuntime {
  const model = new FakeModelRuntime([answer('ok')]);
  model.capabilities = () => ({
    nativeToolCalls: false,
    jsonConstraint: true,
    contextTokens: 1024,
    ...capabilities,
  });
  return model;
}

describe('a runtime with a small window', () => {
  it('gets the compact system prompt when it asks for one', async () => {
    const deps = { ...makeDeps([]), model: small({ compactPrompt: true }) };
    await runAgent(deps, input);
    const system = deps.model.requests[0]?.messages[0]?.content ?? '';
    expect(system).toContain('Tools, as name(arguments): purpose');
    expect(system).not.toContain('inputSchema');
    for (const name of ['ask', 'brief', 'check', 'search']) expect(system).toContain(name);
  });

  it('gets the full system prompt otherwise', async () => {
    const deps = { ...makeDeps([]), model: small({}) };
    await runAgent(deps, input);
    expect(deps.model.requests[0]?.messages[0]?.content).toContain('inputSchema');
  });

  it('keeps the compact prompt inside its share of the window', async () => {
    const deps = { ...makeDeps([]), model: small({ compactPrompt: true, contextTokens: 9216 }) };
    await runAgent(deps, input);
    const system = deps.model.requests[0]?.messages[0]?.content ?? '';
    expect(system).toContain('Tools, as name(arguments): purpose');
    expect(estimateTokens(system)).toBeLessThanOrEqual(compactBudget(9216));
  });
});

describe('usableContext', () => {
  it('is the window when the runtime has no reply size of its own', () => {
    expect(usableContext({ contextTokens: 4096 })).toBe(4096);
  });

  it('takes the runtime reply size in place of the default reserve', () => {
    expect(usableContext({ contextTokens: 9216, replyTokens: 1024 })).toBe(9216 - 512);
  });
});

describe('the saved chat is cut to the reply size of the runtime', () => {
  it('drops old turns sooner when the reply needs more room', async () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `turn ${i} ${'word '.repeat(60)}`,
    }));
    const roomy = { ...makeDeps([]), model: small({ contextTokens: 2000 }) };
    const tight = { ...makeDeps([]), model: small({ contextTokens: 2000, replyTokens: 1400 }) };
    await runAgent(roomy, { ...input, history: turns });
    await runAgent(tight, { ...input, history: turns });
    const count = (d: typeof roomy): number => d.model.requests[0]?.messages.length ?? 0;
    expect(count(tight)).toBeLessThan(count(roomy));
  });
});

describe('the reply constraint names the listed tools', () => {
  it('limits "tool" to the tools the page offers', async () => {
    const deps = makeDeps([answer('ok')]);
    await runAgent(deps, input);
    const schema = deps.model.requests[0]?.jsonSchema as { oneOf: { properties: object }[] };
    const tool = schema.oneOf[1]?.properties as { tool: { enum: string[] } };
    expect(tool.tool.enum).toContain('search');
    expect(tool.tool.enum).toHaveLength(10);
  });

  it('is answer-only on a page with no tools', async () => {
    const deps = makeDeps([answer('ok')], { tools: [] });
    await runAgent(deps, input);
    const schema = deps.model.requests[0]?.jsonSchema as { oneOf: unknown[] };
    expect(schema.oneOf).toHaveLength(1);
  });
});
