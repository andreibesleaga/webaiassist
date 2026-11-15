// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { QuestionTrace } from '../../src/core/activity-trace';
import { traceModel, traceUi } from '../../src/core/activity-wrap';
import type { ChatUI, LoopEvent } from '../../src/core/ports/chat-ui';
import type { ChatRequest, ModelRuntime } from '../../src/core/ports/model-runtime';

const META = {
  origin: 'https://node.example',
  model: 'm',
  place: 'remote' as const,
  windowTokens: 4096,
  text: 'q',
  includeContent: false,
};

function newTrace() {
  const state = { ms: 0 };
  const trace = new QuestionTrace(
    META,
    { nowMs: () => state.ms, nowIso: () => '2026-01-15T10:00:00.000Z' },
    () => 'id',
  );
  return { state, trace };
}

function model(state: { ms: number }, behaviour: (request: ChatRequest) => string): ModelRuntime {
  return {
    load: () => Promise.resolve(),
    unload: () => Promise.resolve(),
    capabilities: () => ({ nativeToolCalls: false, jsonConstraint: false, contextTokens: 4096 }),
    where: () => 'cpu:4',
    chat: (request) => {
      state.ms += 10;
      return Promise.resolve(behaviour(request));
    },
  };
}

describe('traceModel', () => {
  it('passes the request on, adds onUsage, and still calls the loop’s own onToken and onUsage', async () => {
    const { state, trace } = newTrace();
    const seen: string[] = [];
    const inner = model(state, (request) => {
      request.onToken?.('a');
      request.onUsage?.({ promptTokens: 7, completionTokens: 3, costUsd: 0.001 });
      return 'ab';
    });
    const traced = traceModel(inner, trace);
    const reply = await traced.chat({
      messages: [{ role: 'user', content: 'hi' }],
      onToken: (token) => seen.push(token),
      onUsage: (usage) => seen.push(`usage ${usage.promptTokens}`),
    });
    expect(reply).toBe('ab');
    expect(seen).toEqual(['a', 'usage 7']);
    const record = trace.build({ status: 'answered', steps: 1 });
    expect(record.calls[0]).toMatchObject({
      promptTokens: 7,
      completionTokens: 3,
      estimated: false,
    });
    expect(record.cost.usd).toBe(0.001);
    expect(traced.where?.()).toBe('cpu:4');
    expect(traced.capabilities().contextTokens).toBe(4096);
  });

  it('records a call that throws and throws the same error', async () => {
    const { state, trace } = newTrace();
    const inner = model(state, () => {
      throw new Error('service down');
    });
    await expect(
      traceModel(inner, trace).chat({ messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow('service down');
    expect(trace.build({ status: 'failed', steps: 1 }).calls).toHaveLength(1);
  });
});

function ui(answers: boolean[]): { ui: ChatUI; shown: LoopEvent[] } {
  const shown: LoopEvent[] = [];
  return {
    shown,
    ui: {
      show: (event) => shown.push(event),
      confirmToolCall: () => Promise.resolve(answers.shift() ?? false),
      showDraft: () => undefined,
      showProgress: () => undefined,
    },
  };
}

const tool = { name: 'buy', description: 'd' };

describe('traceUi', () => {
  it('records an asked and allowed call from the loop’s own events and passes every event on', async () => {
    const { trace } = newTrace();
    const inner = ui([true]);
    const traced = traceUi(inner.ui, trace);
    expect(await traced.confirmToolCall({ tool, args: { id: 1 }, origin: META.origin })).toBe(true);
    traced.show({ kind: 'tool-call', name: 'buy', args: { id: 1 } });
    traced.show({ kind: 'tool-result', name: 'buy', ok: true, text: 'done' });
    traced.show({ kind: 'answer', text: 'ok' });
    expect(inner.shown.map((e) => e.kind)).toEqual(['tool-call', 'tool-result', 'answer']);
    expect(trace.build({ status: 'answered', steps: 1 }).tools[0]).toMatchObject({
      name: 'buy',
      asked: true,
      decision: 'allowed',
      ok: true,
    });
  });

  it('records a denied call', async () => {
    const { trace } = newTrace();
    const traced = traceUi(ui([false]).ui, trace);
    await traced.confirmToolCall({ tool, args: {}, origin: META.origin });
    traced.show({ kind: 'tool-denied', name: 'buy' });
    expect(trace.build({ status: 'answered', steps: 1 }).tools[0]).toMatchObject({
      asked: true,
      decision: 'denied',
    });
  });

  it('passes draft, progress and note through untouched', () => {
    const { trace } = newTrace();
    const calls: string[] = [];
    const traced = traceUi(
      {
        show: () => calls.push('show'),
        confirmToolCall: () => Promise.resolve(true),
        showDraft: () => calls.push('draft'),
        showProgress: () => calls.push('progress'),
      },
      trace,
    );
    traced.showDraft('x');
    traced.showProgress({ fraction: 1, text: '' });
    traced.show({ kind: 'note', text: 'n' });
    expect(calls).toEqual(['draft', 'progress', 'show']);
  });
});
