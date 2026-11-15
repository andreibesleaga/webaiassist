// SPDX-License-Identifier: Apache-2.0
// Filters and totals of the activity log, for the Activity tab and the export.
import type { CostKind, QuestionRecord } from './ports/activity-log';

export interface Filter {
  readonly origin?: string;
  readonly model?: string;
  readonly day?: string;
}

export interface Totals {
  readonly questions: number;
  readonly toolCalls: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** At least one count was estimated, not reported by the runtime. */
  readonly estimated: boolean;
  /** The sum of the prices services reported, in US dollars. */
  readonly costUsd: number;
  /** Questions to a remote service that sent no price (not in `costUsd`). */
  readonly unpriced: number;
  /** `none` when every question was local; `reported` when any price was reported; else `unknown`. */
  readonly costKind: CostKind;
  readonly totalMs: number;
}

export function filterRecords(
  records: readonly QuestionRecord[],
  filter: Filter,
): QuestionRecord[] {
  return records.filter(
    (r) =>
      (filter.origin === undefined || r.origin === filter.origin) &&
      (filter.model === undefined || r.model === filter.model) &&
      (filter.day === undefined || r.day === filter.day),
  );
}

function costKind(records: readonly QuestionRecord[]): CostKind {
  if (records.some((r) => r.cost.kind === 'reported')) return 'reported';
  return records.some((r) => r.cost.kind === 'unknown') ? 'unknown' : 'none';
}

export function totals(records: readonly QuestionRecord[]): Totals {
  const sum = (pick: (r: QuestionRecord) => number): number =>
    records.reduce((total, r) => total + pick(r), 0);
  return {
    questions: records.length,
    toolCalls: sum((r) => r.tools.length),
    promptTokens: sum((r) => r.promptTokens),
    completionTokens: sum((r) => r.completionTokens),
    estimated: records.some((r) => r.tokensEstimated),
    costUsd: sum((r) => r.cost.usd ?? 0),
    unpriced: records.filter((r) => r.cost.kind === 'unknown').length,
    costKind: costKind(records),
    totalMs: sum((r) => r.totalMs),
  };
}

/** One total per day, newest day first. */
export function totalsByDay(records: readonly QuestionRecord[]): { day: string; totals: Totals }[] {
  const days = [...new Set(records.map((r) => r.day))].sort().reverse();
  return days.map((day) => ({ day, totals: totals(records.filter((r) => r.day === day)) }));
}

/** The values the three filters offer. */
export function choices(records: readonly QuestionRecord[]): {
  origins: string[];
  models: string[];
  days: string[];
} {
  const unique = (values: string[]): string[] => [...new Set(values)];
  return {
    origins: unique(records.map((r) => r.origin)).sort(),
    models: unique(records.map((r) => r.model)).sort(),
    days: unique(records.map((r) => r.day))
      .sort()
      .reverse(),
  };
}
