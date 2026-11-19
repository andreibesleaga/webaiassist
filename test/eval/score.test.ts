// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { EvalPrompt } from '../../scripts/eval/prompts.ts';
import { scorePrompt, summarize, taskDone, type Observation } from '../../scripts/eval/score.ts';

const PAGE = ['ask', 'search', 'read', 'links', 'propose', 'remember'];
const p = (tools: string[], facts: string[] = ['reviewer']): EvalPrompt => ({
  n: 3,
  text: 'q',
  tools,
  facts,
  scripted: 's',
});
const seen = (extra: Partial<Observation> = {}): Observation => ({
  tools: ['search'],
  gates: ['search'],
  answer: 'One Reviewer per change.',
  errors: [],
  repeated: 0,
  firstTokenMs: 1500,
  totalMs: 4200,
  timedOut: false,
  ...extra,
});
const ctx = { model: 'qwen', target: 'stub', pageTools: PAGE };

describe('scoring one prompt by the rules of docs/EVAL.md', () => {
  it('scores the right tool, the gate, the fact (any case) and the times', () => {
    expect(scorePrompt(p(['search']), seen(), ctx)).toEqual({
      n: 3,
      model: 'qwen',
      target: 'stub',
      tools: ['search'],
      toolRight: 1,
      firstToolRight: 1,
      toolUsed: 1,
      taskDone: 1,
      gateShown: 1,
      factInAnswer: 1,
      hallucinated: [],
      repeated: 0,
      firstTokenS: 1.5,
      totalS: 4.2,
    });
  });

  it('wants the expected tools in order, and no tool for an answer-only prompt', () => {
    expect(scorePrompt(p(['search', 'read']), seen(), ctx).toolRight).toBe(0);
    const chat = scorePrompt(p([], []), seen({ tools: [], gates: [], answer: 'Hi' }), ctx);
    expect(chat).toMatchObject({ toolRight: 1, gateShown: null, factInAnswer: null });
    expect(scorePrompt(p([], []), seen({ tools: [], answer: '' }), ctx).toolRight).toBe(0);
  });

  it('scores the first tool and "a tool was used" apart from the exact sequence', () => {
    const both = ['search', 'read'];
    const asked = scorePrompt(p(['search']), seen({ tools: both, gates: both }), ctx);
    expect(asked).toMatchObject({ toolRight: 0, firstToolRight: 1, toolUsed: 1 });
    const wrong = scorePrompt(p(['search']), seen({ tools: ['read'], gates: ['read'] }), ctx);
    expect(wrong).toMatchObject({ toolRight: 0, firstToolRight: 0, toolUsed: 1 });
    const none = scorePrompt(p(['search']), seen({ tools: [], gates: [], answer: 'x' }), ctx);
    expect(none).toMatchObject({ toolRight: 0, firstToolRight: 0, toolUsed: 0 });
  });

  it('scores a prompt that expects no tool: first tool right when none ran, "used" not scored', () => {
    const quiet = scorePrompt(p([], []), seen({ tools: [], gates: [], answer: 'Hi' }), ctx);
    expect(quiet).toMatchObject({ firstToolRight: 1, toolUsed: null });
    const called = scorePrompt(p([], []), seen(), ctx);
    expect(called).toMatchObject({ firstToolRight: 0, toolUsed: null });
  });

  it('fails the gate when a call ran without its question', () => {
    const run = seen({ tools: ['search', 'read'], gates: ['search'] });
    expect(scorePrompt(p(['search', 'read']), run, ctx).gateShown).toBe(0);
  });

  it('does not count the extension’s own graph tool as a tool nobody offers; it is still not the expected one', () => {
    const row = scorePrompt(p(['links']), seen({ tools: ['webaiassist_query_graph'] }), ctx);
    expect(row.hallucinated).toEqual([]);
    expect(row.toolRight).toBe(0);
    expect(row.toolUsed).toBe(1);
  });

  it('finds hallucinated tools in calls and in the loop’s error', () => {
    const run = seen({
      tools: ['explain'],
      errors: ['The model gave no valid action: unknown tool "summarize".'],
    });
    const row = scorePrompt(p(['search']), run, ctx);
    expect(row.hallucinated).toEqual(['explain', 'summarize']);
    expect(row.error).toBe('The model gave no valid action: unknown tool "summarize".');
  });

  it('counts the repeated calls the loop refused, and shows them next to the error', () => {
    const row = scorePrompt(p(['search']), seen({ repeated: 2 }), ctx);
    expect(row.repeated).toBe(2);
    expect(row.error).toBeUndefined();
  });

  it('does not score facts on the live site, and marks a timeout', () => {
    const row = scorePrompt(p(['search']), seen({ timedOut: true, firstTokenMs: null }), {
      ...ctx,
      target: 'live',
    });
    expect(row).toMatchObject({ factInAnswer: null, firstTokenS: null, error: 'timed out' });
  });
});

describe('summary per model and target', () => {
  it('adds up the rows and takes the median first token', () => {
    const rows = [
      scorePrompt(p(['search']), seen(), ctx),
      scorePrompt(
        p(['search']),
        seen({ tools: [], gates: [], answer: 'x', firstTokenMs: 500 }),
        ctx,
      ),
      scorePrompt(p([], []), seen({ tools: [], gates: [], firstTokenMs: 9000, repeated: 1 }), ctx),
    ];
    expect(summarize(rows)).toEqual([
      {
        model: 'qwen',
        target: 'stub',
        prompts: 3,
        toolRight: 2,
        firstToolRight: 2,
        toolUsed: '1 of 2',
        taskDone: 2,
        gateShown: '1 of 1',
        factInAnswer: '1 of 2',
        hallucinated: 0,
        errors: 0,
        repeated: 1,
        medianFirstTokenS: 1.5,
      },
    ]);
  });
});

describe('task done: the answer a user would accept, by any valid tool path', () => {
  const ask = { ...p(['ask'], ['context']), accept: ['search'] };
  const answer = 'Handoffs pass context between agents.';
  const done = (prompt: EvalPrompt, extra: Partial<Observation>) =>
    taskDone(prompt, seen({ answer, ...extra }), 'stub');

  it('accepts the expected tool, an accepted other first tool, and extra read-only calls', () => {
    expect(done(ask, { tools: ['ask'] })).toBe(1);
    expect(done(ask, { tools: ['search', 'read'] })).toBe(1);
    expect(done(ask, { tools: ['links'] })).toBe(0);
  });

  it('wants every expected tool to have been called', () => {
    expect(done(p(['search', 'read'], ['context']), { tools: ['search'] })).toBe(0);
    expect(done(p(['search', 'read'], ['context']), { tools: ['search', 'ask', 'read'] })).toBe(1);
  });

  it('fails on a missing fact, an error, a timeout, or a changing tool nobody asked for', () => {
    expect(done(ask, { tools: ['ask'], answer: 'I do not know.' })).toBe(0);
    expect(done(ask, { tools: ['ask'], errors: ['stopped after 6 tool steps'] })).toBe(0);
    expect(done(ask, { tools: ['ask'], timedOut: true })).toBe(0);
    expect(done(ask, { tools: ['ask', 'propose'] })).toBe(0);
    expect(done(p(['propose'], ['context']), { tools: ['propose'] })).toBe(1);
  });

  it('for a prompt that expects no tool, wants an answer and no tool', () => {
    expect(done(p([], []), { tools: [] })).toBe(1);
    expect(done(p([], []), { tools: ['search'] })).toBe(0);
  });

  it('is counted in the summary', () => {
    const rows = [scorePrompt(ask, seen({ tools: ['search', 'read'], answer }), ctx)];
    expect(rows[0]).toMatchObject({ toolRight: 0, taskDone: 1 });
    expect(summarize(rows)[0]).toMatchObject({ taskDone: 1 });
  });
});
