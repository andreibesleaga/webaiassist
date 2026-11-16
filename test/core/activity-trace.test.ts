// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { QuestionTrace, type TraceMeta } from '../../src/core/activity-trace';
import { SITE_BACKGROUND } from '../../src/core/tool-rules';
import type { ChatMessage } from '../../src/core/types';

/** A steady clock the test moves by hand, and a fixed past date. */
function clock() {
  const state = { ms: 1000 };
  return {
    state,
    now: { nowMs: () => state.ms, nowIso: () => '2026-01-15T10:00:00.000Z' },
  };
}

const META: TraceMeta = {
  origin: 'https://node.example',
  model: 'Qwen3 4B',
  place: 'gpu',
  windowTokens: 4096,
  text: 'What is here?',
  includeContent: false,
};

function trace(meta: Partial<TraceMeta> = {}) {
  const c = clock();
  return { c, t: new QuestionTrace({ ...META, ...meta }, c.now, () => 'q1') };
}

const messages: ChatMessage[] = [
  { role: 'system', content: 'Rules.\n\nTools on this page (data from the page):\n- a: does a' },
  { role: 'user', content: 'Earlier question' },
  { role: 'tool', content: `${SITE_BACKGROUND}\nfacts` },
  { role: 'user', content: 'What is here?' },
];

describe('model calls', () => {
  it('times the first word and the whole call, and estimates tokens when none are reported', () => {
    const { c, t } = trace();
    const call = t.beginCall(messages);
    c.state.ms += 300;
    call.token();
    call.token();
    c.state.ms += 700;
    call.end('{"answer":"hello"}');
    const record = t.build({ status: 'answered', steps: 1 });
    expect(record.calls[0]).toMatchObject({ firstTokenMs: 300, totalMs: 1000, estimated: true });
    expect(record.calls[0]?.promptTokens).toBeGreaterThan(0);
    expect(record.calls[0]?.completionTokens).toBeGreaterThan(0);
    expect(record.firstTokenMs).toBe(300);
    expect(record.tokensEstimated).toBe(true);
  });

  it('uses the counts and the price a service reports and says they are not estimated', () => {
    const { t } = trace({ place: 'remote', host: 'openrouter.ai' });
    const call = t.beginCall(messages);
    call.usage({ promptTokens: 900, completionTokens: 40, costUsd: 0.0003 });
    call.end('x');
    const second = t.beginCall(messages);
    second.usage({ promptTokens: 1000, completionTokens: 10, costUsd: 0.0002 });
    second.end('y');
    const record = t.build({ status: 'answered', steps: 2 });
    expect(record).toMatchObject({
      promptTokens: 1900,
      completionTokens: 50,
      tokensEstimated: false,
      host: 'openrouter.ai',
    });
    expect(record.cost.kind).toBe('reported');
    expect(record.cost.usd).toBeCloseTo(0.0005, 10);
  });

  it('estimates only the count a service left out', () => {
    const { t } = trace({ place: 'remote' });
    const call = t.beginCall(messages);
    call.usage({ promptTokens: 500 });
    call.end('some reply text');
    const record = t.build({ status: 'answered', steps: 1 });
    expect(record.calls[0]?.promptTokens).toBe(500);
    expect(record.calls[0]?.estimated).toBe(true);
  });

  it('shows cost "none" for every local place and "unknown" for a remote service with no price', () => {
    for (const place of ['gpu', 'cpu', 'chrome', 'own-server'] as const) {
      const { t } = trace({ place });
      t.beginCall(messages).end('x');
      expect(t.build({ status: 'answered', steps: 1 }).cost).toEqual({ kind: 'none' });
    }
    const { t } = trace({ place: 'remote' });
    t.beginCall(messages).end('x');
    expect(t.build({ status: 'answered', steps: 1 }).cost).toEqual({ kind: 'unknown' });
  });

  it('splits the window into instructions, tool list, site files, chat and reply', () => {
    const { t } = trace();
    t.beginCall(messages).end('{"answer":"ok"}');
    const { context } = t.build({ status: 'answered', steps: 1 });
    expect(context.instructions).toBeGreaterThan(0);
    expect(context.tools).toBeGreaterThan(0);
    expect(context.site).toBeGreaterThan(0);
    expect(context.chat).toBeGreaterThan(0);
    expect(context.reply).toBeGreaterThan(0);
  });

  it('keeps the call that used most of the window as the question context', () => {
    const { t } = trace();
    t.beginCall([{ role: 'user', content: 'short' }]).end('a');
    t.beginCall([{ role: 'user', content: 'a much longer message '.repeat(50) }]).end('a');
    const record = t.build({ status: 'answered', steps: 2 });
    expect(record.context).toEqual(record.calls[1]?.context);
  });

  it('records a call that threw as a call with its time', () => {
    const { c, t } = trace();
    const call = t.beginCall(messages);
    c.state.ms += 50;
    call.fail();
    expect(t.build({ status: 'failed', steps: 1, error: 'boom' }).calls[0]?.totalMs).toBe(50);
  });
});

describe('tool calls', () => {
  it('a call that was asked and allowed: decision, duration, result size', () => {
    const { c, t } = trace();
    t.toolAsked('search', { q: 'cats' });
    t.toolAnswered(true);
    t.toolStarted('search', { q: 'cats' });
    c.state.ms += 2000;
    t.toolFinished('search', true, 'héllo');
    const tool = t.build({ status: 'answered', steps: 1 }).tools[0];
    expect(tool).toMatchObject({
      name: 'search',
      asked: true,
      decision: 'allowed',
      durationMs: 2000,
      resultBytes: 6,
      ok: true,
      builtin: false,
      argNames: ['q'],
    });
    expect(tool?.argBytes).toBe(JSON.stringify({ q: 'cats' }).length);
  });

  it('a read-only call that was not asked is "not-asked"', () => {
    const { t } = trace();
    t.toolStarted('read', {});
    t.toolFinished('read', true, 'x');
    expect(t.build({ status: 'answered', steps: 1 }).tools[0]).toMatchObject({
      asked: false,
      decision: 'not-asked',
    });
  });

  it('a denied call, asked or refused without asking, has no duration', () => {
    const { t } = trace();
    t.toolAsked('buy', { id: 1 });
    t.toolAnswered(false);
    t.toolDenied('buy');
    t.toolDenied('buy');
    const tools = t.build({ status: 'answered', steps: 1 }).tools;
    expect(tools.map((x) => [x.asked, x.decision])).toEqual([
      [true, 'denied'],
      [false, 'denied'],
    ]);
    expect(tools[0]?.durationMs).toBeUndefined();
  });

  it('a failed call keeps its error text, cut, only with content on', () => {
    const { t } = trace({ includeContent: true });
    t.toolStarted('x', {});
    t.toolFinished('x', false, `Tool error: ${'e'.repeat(1000)}`);
    const tool = t.build({ status: 'answered', steps: 1 }).tools[0];
    expect(tool?.ok).toBe(false);
    expect(tool?.error?.length).toBeLessThanOrEqual(300);
  });

  it('with content off, a failed call is kept as failed without its error text', () => {
    const { t } = trace();
    t.toolStarted('x', { query: 'my medical search' });
    t.toolFinished('x', false, 'Tool error: no results for my medical search');
    const record = t.build({ status: 'answered', steps: 1 });
    expect(record.tools[0]).toMatchObject({ ok: false, argNames: ['query'] });
    expect(record.tools[0]?.error).toBeUndefined();
    expect(JSON.stringify(record)).not.toContain('medical');
  });

  it('marks the built-in tool and has a hook for a built-in call that makes no event', () => {
    const { t } = trace();
    t.toolStarted('webaiassist_query_graph', { q: 'x' });
    t.toolFinished('webaiassist_query_graph', true, 'rows');
    t.builtinCall({ name: 'other_builtin', args: { a: 1 }, durationMs: 5, text: 'ok', ok: true });
    const tools = t.build({ status: 'answered', steps: 1 }).tools;
    expect(tools.map((x) => [x.name, x.builtin])).toEqual([
      ['webaiassist_query_graph', true],
      ['other_builtin', true],
    ]);
    expect(tools[1]?.durationMs).toBe(5);
  });
});

describe('content and secrets', () => {
  it('keeps no question, argument value or result unless "include content" is on', () => {
    const { t } = trace();
    t.toolStarted('search', { q: 'private words' });
    t.toolFinished('search', true, 'private result');
    const record = t.build({ status: 'answered', steps: 1 });
    expect(JSON.stringify(record)).not.toMatch(/private|What is here/);
    expect(record.includeContent).toBe(false);
  });

  it('keeps them, cut and with secret-looking arguments hidden, when it is on', () => {
    const { t } = trace({ includeContent: true });
    t.toolStarted('login', { user: 'ann', password: 'hunter2hunter2' });
    t.toolFinished('login', true, 'r'.repeat(9000));
    const record = t.build({ status: 'answered', steps: 1 });
    expect(record.text).toBe('What is here?');
    expect(record.tools[0]?.args).toEqual({ user: 'ann', password: '[redacted]' });
    expect(record.tools[0]?.result?.length).toBe(4000);
  });

  it('keeps no argument values at all when they are longer than the content limit', () => {
    const { t } = trace({ includeContent: true });
    t.toolStarted('big', { text: 'x'.repeat(5000) });
    t.toolFinished('big', true, 'ok');
    const tool = t.build({ status: 'answered', steps: 1 }).tools[0];
    expect(tool?.args).toBeUndefined();
    expect(tool?.argBytes).toBeGreaterThan(5000);
  });

  it('removes a known secret from every text, with content on or off', () => {
    const key = 'sk-or-v1-secret-0123456789';
    for (const includeContent of [false, true]) {
      const { t } = trace({ includeContent, secrets: [key], text: `use ${key}` });
      t.toolStarted('x', { a: key });
      t.toolFinished('x', false, `Tool error: bad ${key}`);
      const record = t.build({ status: 'failed', steps: 1, error: `denied for ${key}` });
      expect(JSON.stringify(record)).not.toContain(key);
    }
  });
});

describe('the end of a question', () => {
  it('maps how it ended and keeps the error text, cut', () => {
    const cases = [
      ['answered', 'answered'],
      ['stopped', 'stopped'],
      ['step-cap', 'step-limit'],
      ['failed', 'error'],
    ] as const;
    for (const [status, outcome] of cases) {
      const { t } = trace();
      const record = t.build({ status, steps: 3, error: 'x'.repeat(900) });
      expect(record.outcome).toBe(outcome);
      expect(record.steps).toBe(3);
      expect(record.error?.length).toBeLessThanOrEqual(300);
    }
  });

  it('carries the time, day, site, model, place and window, and the size of the entry', () => {
    const { c, t } = trace();
    c.state.ms += 1234;
    const record = t.build({ status: 'answered', steps: 1 });
    expect(record).toMatchObject({
      id: 'q1',
      at: '2026-01-15T10:00:00.000Z',
      day: '2026-01-15',
      origin: 'https://node.example',
      model: 'Qwen3 4B',
      place: 'gpu',
      windowTokens: 4096,
      totalMs: 1234,
    });
    expect(record.bytes).toBeGreaterThan(100);
  });
});
