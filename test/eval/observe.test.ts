// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  errorLines,
  firstTokenMs,
  modelState,
  percent,
  pickAnswer,
  repeatedCalls,
  snapshotOf,
  toolCount,
  toolFromTitle,
  type Item,
} from '../../scripts/eval/observe.ts';

const item = (who: string | null, text: string, untrusted = false): Item => ({
  who,
  untrusted,
  text,
});

describe('toolFromTitle', () => {
  it('names the tool of a tool question and ignores the site question', () => {
    expect(toolFromTitle('Run the tool search?')).toBe('search');
    expect(toolFromTitle('Use the tools of http://localhost:1?')).toBeNull();
  });
});

describe('pickAnswer and errorLines', () => {
  const items = [
    item('You', 'q'),
    item(null, 'Tool call: search'),
    item(null, 'Result', true),
    item('WebAIAssist', ' The answer. '),
    item(null, 'Error: boom'),
  ];
  it('takes the last assistant turn', () => {
    expect(pickAnswer(items)).toBe('The answer.');
    expect(pickAnswer([item('You', 'q')])).toBe('');
  });
  it('lists the error lines', () => {
    expect(errorLines(items)).toEqual(['Error: boom']);
  });
});

describe('repeatedCalls', () => {
  it('counts the loop’s notes about a call it did not run again', () => {
    const again = 'The assistant repeated a tool call it had already made. It was given …';
    const stop = 'The assistant repeated a tool call again and was stopped. The answer …';
    const items = [item('You', 'q'), item(null, again), item(null, 'Error: x'), item(null, stop)];
    expect(repeatedCalls(items)).toBe(2);
    expect(repeatedCalls([item('WebAIAssist', again)])).toBe(0);
    expect(repeatedCalls([])).toBe(0);
  });
});

describe('firstTokenMs', () => {
  const at = (t: number, others: number, last: string, gate = false) => ({ t, others, last, gate });
  it('is the first change after the first snapshot', () => {
    const snaps = [at(1100, 0, ''), at(1200, 0, ''), at(1900, 1, 'He'), at(2500, 1, 'Hello')];
    expect(firstTokenMs(snaps, 1000)).toBe(900);
  });
  it('counts a confirmation question and longer text', () => {
    expect(firstTokenMs([at(10, 0, ''), at(40, 0, '', true)], 0)).toBe(40);
    expect(firstTokenMs([at(10, 1, 'a'), at(70, 1, 'ab')], 0)).toBe(70);
  });
  it('is null when nothing changes', () => {
    expect(firstTokenMs([at(10, 0, ''), at(20, 0, '')], 0)).toBeNull();
    expect(firstTokenMs([], 0)).toBeNull();
  });
  it('snapshots skip the user turn', () => {
    expect(snapshotOf(5, [item('You', 'q'), item('WebAIAssist', 'hi')], false)).toEqual({
      t: 5,
      others: 1,
      last: 'hi',
      gate: false,
    });
  });
});

describe('model line helpers', () => {
  it('reads the model state', () => {
    expect(modelState('Ready: Scripted test model.')).toBe('ready');
    expect(modelState('The model did not load: integrity')).toBe('failed');
    expect(modelState('Loading Qwen3…')).toBe('loading');
  });
  it('formats progress and counts tools', () => {
    expect(percent(0.456)).toBe('46%');
    expect(percent(Number.NaN)).toBe('?');
    expect(toolCount('localhost:1 — 10 WebMCP tools')).toBe(10);
    expect(toolCount('localhost:1 — 1 WebMCP tool')).toBe(1);
    expect(toolCount('localhost:1 — no WebMCP tools (use …)')).toBe(0);
  });
});
