// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { choices, filterRecords, totals, totalsByDay } from '../../src/core/activity-summary';
import { record } from '../helpers-activity';

const remote = (id: string, day: string, usd?: number) =>
  record({
    id,
    day,
    at: `${day}T09:00:00.000Z`,
    origin: 'https://b.example',
    model: 'vendor/small',
    place: 'remote',
    promptTokens: 1000,
    completionTokens: 50,
    tokensEstimated: false,
    cost: usd === undefined ? { kind: 'unknown' } : { kind: 'reported', usd },
  });

const rows = [
  record({ id: 'a', tools: [{ name: 't' } as never, { name: 'u' } as never] }),
  remote('b', '2026-01-15', 0.0003),
  remote('c', '2026-01-16', 0.0002),
  remote('d', '2026-01-16'),
];

describe('filterRecords', () => {
  it('filters by site, model and day, all together', () => {
    expect(filterRecords(rows, {}).length).toBe(4);
    expect(filterRecords(rows, { origin: 'https://b.example' }).map((r) => r.id)).toEqual([
      'b',
      'c',
      'd',
    ]);
    expect(filterRecords(rows, { model: 'Qwen3 4B' }).map((r) => r.id)).toEqual(['a']);
    expect(
      filterRecords(rows, { day: '2026-01-16', model: 'vendor/small' }).map((r) => r.id),
    ).toEqual(['c', 'd']);
  });
});

describe('totals', () => {
  it('sums questions, tool calls, tokens, time and the prices the services reported', () => {
    const sum = totals(rows);
    expect(sum).toMatchObject({
      questions: 4,
      toolCalls: 2,
      promptTokens: 600 + 3000,
      completionTokens: 20 + 150,
      estimated: true,
      costUsd: 0.0005,
      unpriced: 1,
      totalMs: 6000,
    });
  });

  it('says cost is none when every question was local', () => {
    expect(totals([rows[0]!]).costKind).toBe('none');
    expect(totals(rows).costKind).toBe('reported');
    expect(totals([remote('x', '2026-01-15')]).costKind).toBe('unknown');
    expect(totals([]).costKind).toBe('none');
  });

  it('has one total per day, newest day first', () => {
    const days = totalsByDay(rows);
    expect(days.map((d) => d.day)).toEqual(['2026-01-16', '2026-01-15']);
    expect(days[0]?.totals.questions).toBe(2);
    expect(days[0]?.totals.costUsd).toBe(0.0002);
  });
});

describe('choices', () => {
  it('lists the sites, models and days present, sorted', () => {
    expect(choices(rows)).toEqual({
      origins: ['https://b.example', 'https://node.example'],
      models: ['Qwen3 4B', 'vendor/small'],
      days: ['2026-01-16', '2026-01-15'],
    });
  });
});
