// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { rerunToolCall } from '../../src/core/activity-rerun';
import type { ToolCall } from '../../src/core/ports/activity-log';
import type { ToolCallApproval } from '../../src/core/ports/chat-ui';
import type { ToolBridge } from '../../src/core/ports/tool-bridge';
import type { ToolInfo } from '../../src/core/types';

const ORIGIN = 'https://node.example';
const TOOL: ToolInfo = {
  name: 'buy',
  description: 'Buys',
  annotations: { readOnlyHint: true },
};

const past: ToolCall = {
  name: 'buy',
  builtin: false,
  at: '2026-01-15T10:00:00.000Z',
  asked: false,
  decision: 'not-asked',
  argNames: ['id'],
  argBytes: 8,
  args: { id: 1 },
};

function setup(over: { origin?: string; tools?: ToolInfo[]; answer?: boolean } = {}) {
  const calls: unknown[] = [];
  const asked: ToolCallApproval[] = [];
  const tools = over.tools ?? [TOOL];
  const bridge: ToolBridge = {
    list: () => Promise.resolve({ origin: over.origin ?? ORIGIN, tools }),
    call: (target, name, args) => {
      calls.push({ target, name, args });
      return Promise.resolve({ ok: true, text: 'bought' });
    },
    onChange: () => () => undefined,
  };
  const confirm = (request: ToolCallApproval): Promise<boolean> => {
    asked.push(request);
    return Promise.resolve(over.answer ?? true);
  };
  return { calls, asked, deps: { bridge, confirm } };
}

describe('rerunToolCall', () => {
  it('asks the user, even for a read-only tool, and runs only after Allow', async () => {
    const { deps, asked, calls } = setup();
    const result = await rerunToolCall(deps, { tabId: 3, origin: ORIGIN }, past);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ origin: ORIGIN, args: { id: 1 } });
    expect(calls).toEqual([{ target: { tabId: 3, origin: ORIGIN }, name: 'buy', args: { id: 1 } }]);
    expect(result).toEqual({ state: 'ran', ok: true, text: 'bought' });
  });

  it('does not run when the user denies', async () => {
    const { deps, calls } = setup({ answer: false });
    expect(await rerunToolCall(deps, { tabId: 3, origin: ORIGIN }, past)).toEqual({
      state: 'denied',
    });
    expect(calls).toEqual([]);
  });

  it('cannot run without saved arguments (include content was off), and asks nothing', async () => {
    const { deps, asked } = setup();
    const { args: _unused, ...bare } = past;
    expect(await rerunToolCall(deps, { tabId: 3, origin: ORIGIN }, bare)).toEqual({
      state: 'no-arguments',
    });
    expect(asked).toEqual([]);
  });

  it('cannot run arguments that had hidden values', async () => {
    const { deps, asked } = setup();
    const hidden = { ...past, args: { user: 'ann', password: '[redacted]' } };
    expect((await rerunToolCall(deps, { tabId: 3, origin: ORIGIN }, hidden)).state).toBe(
      'no-arguments',
    );
    expect(asked).toEqual([]);
  });

  it('refuses when the tab is on another site, or the page no longer has the tool', async () => {
    const other = setup({ origin: 'https://other.example' });
    expect((await rerunToolCall(other.deps, { tabId: 3, origin: ORIGIN }, past)).state).toBe(
      'other-site',
    );
    const gone = setup({ tools: [] });
    expect((await rerunToolCall(gone.deps, { tabId: 3, origin: ORIGIN }, past)).state).toBe(
      'tool-missing',
    );
    expect([...other.asked, ...gone.asked]).toEqual([]);
  });

  it('refuses a built-in tool, which the page does not list', async () => {
    const { deps } = setup();
    const builtin = { ...past, name: 'webaiassist_query_graph', builtin: true };
    expect((await rerunToolCall(deps, { tabId: 3, origin: ORIGIN }, builtin)).state).toBe(
      'tool-missing',
    );
  });

  it('refuses when the page changed the tool while the user decided', async () => {
    const lists = [[TOOL], [{ ...TOOL, description: 'Now different' }]];
    const calls: unknown[] = [];
    const bridge: ToolBridge = {
      list: () => Promise.resolve({ origin: ORIGIN, tools: lists.shift() ?? [] }),
      call: () => {
        calls.push(1);
        return Promise.resolve({ ok: true, text: '' });
      },
      onChange: () => () => undefined,
    };
    const result = await rerunToolCall(
      { bridge, confirm: () => Promise.resolve(true) },
      { tabId: 3, origin: ORIGIN },
      past,
    );
    expect(result.state).toBe('tool-changed');
    expect(calls).toEqual([]);
  });

  it('reports a call that throws as a failed run', async () => {
    const { deps } = setup();
    deps.bridge.call = () => Promise.reject(new Error('page gone'));
    const result = await rerunToolCall(deps, { tabId: 3, origin: ORIGIN }, past);
    expect(result).toMatchObject({ state: 'ran', ok: false });
  });
});
