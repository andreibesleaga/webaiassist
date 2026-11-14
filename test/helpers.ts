// SPDX-License-Identifier: Apache-2.0
import { AjvArgsValidator } from '../src/adapters/ajv-args-validator';
import type { AgentDeps } from '../src/core/agent-loop';
import type { ToolInfo } from '../src/core/types';
import { FakeChatUI } from '../src/fakes/fake-chat-ui';
import { FakeModelRuntime } from '../src/fakes/fake-model-runtime';
import { FakeToolBridge } from '../src/fakes/fake-tool-bridge';
import { FixedClock } from '../src/fakes/fixed-clock';
import { InMemoryMemory } from '../src/fakes/in-memory-memory';
import fixture from '../fixtures/agsc-tools.json';

/** The ten tools an AgenticSystemCore node page registers. */
export const AGSC_TOOLS: readonly ToolInfo[] = fixture.tools;

export function tool(name: string): ToolInfo {
  const found = AGSC_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no fixture tool ${name}`);
  return found;
}

export interface TestDeps extends AgentDeps {
  readonly model: FakeModelRuntime;
  readonly bridge: FakeToolBridge;
  readonly memory: InMemoryMemory;
  readonly ui: FakeChatUI;
}

export function makeDeps(
  replies: readonly string[],
  options: { allow?: boolean; tools?: readonly ToolInfo[] } = {},
): TestDeps {
  return {
    model: new FakeModelRuntime(replies),
    bridge: new FakeToolBridge(options.tools ?? AGSC_TOOLS),
    memory: new InMemoryMemory(),
    ui: new FakeChatUI(options.allow ?? true),
    clock: new FixedClock(),
    validator: new AjvArgsValidator(),
  };
}

export const call = (name: string, args: object): string =>
  JSON.stringify({ tool: name, arguments: args });
export const answer = (text: string): string => JSON.stringify({ answer: text });
