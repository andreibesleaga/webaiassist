// SPDX-License-Identifier: Apache-2.0
// The automatic scoring of docs/EVAL.md, "Scoring": per prompt, the expected tools in order,
// the confirmation question before every tool call, an expected fact in the answer (stub node
// only), tools the page does not offer, repeated calls the loop refused, and the times; then a summary per model and target.
import type { EvalPrompt } from './prompts.ts';

/** What the panel showed for one prompt (scripts/eval/panel.ts). */
export interface Observation {
  readonly tools: readonly string[];
  /** Tool names whose "Run the tool …?" question appeared, in order. */
  readonly gates: readonly string[];
  readonly answer: string;
  readonly errors: readonly string[];
  /** Tool calls the loop did not run again because the model had already made them. */
  readonly repeated: number;
  readonly firstTokenMs: number | null;
  readonly totalMs: number;
  readonly timedOut: boolean;
}

export interface Row {
  readonly n: number;
  readonly model: string;
  readonly target: string;
  readonly tools: readonly string[];
  readonly toolRight: 0 | 1;
  /** The first tool is the first expected one (no tool at all when none is expected). */
  readonly firstToolRight: 0 | 1;
  /** A tool was used; null when the prompt expects no tool. */
  readonly toolUsed: 0 | 1 | null;
  /** The task was done by any valid tool path (see taskDone). */
  readonly taskDone: 0 | 1;
  /** null when no tool ran. */
  readonly gateShown: 0 | 1 | null;
  /** null when the prompt or the target has no fact to check. */
  readonly factInAnswer: 0 | 1 | null;
  readonly hallucinated: readonly string[];
  readonly repeated: number;
  readonly firstTokenS: number | null;
  readonly totalS: number;
  readonly error?: string;
}

export interface ScoreContext {
  readonly model: string;
  readonly target: string;
  readonly pageTools: readonly string[];
}

const bit = (ok: boolean): 0 | 1 => (ok ? 1 : 0);
const seconds = (ms: number): number => Math.round(ms / 100) / 10;

function toolRight(prompt: EvalPrompt, seen: Observation): 0 | 1 {
  if (prompt.tools.length === 0) return bit(seen.tools.length === 0 && seen.answer.trim() !== '');
  return bit(JSON.stringify(seen.tools) === JSON.stringify(prompt.tools));
}

function firstToolRight(prompt: EvalPrompt, seen: Observation): 0 | 1 {
  if (prompt.tools.length === 0) return toolRight(prompt, seen);
  return bit(seen.tools[0] === prompt.tools[0]);
}

function toolUsed(prompt: EvalPrompt, seen: Observation): 0 | 1 | null {
  return prompt.tools.length === 0 ? null : bit(seen.tools.length > 0);
}

function gateShown(seen: Observation): 0 | 1 | null {
  if (seen.tools.length === 0) return null;
  return bit(seen.tools.every((tool, i) => seen.gates[i] === tool));
}

function factInAnswer(prompt: EvalPrompt, seen: Observation, target: string): 0 | 1 | null {
  if (target !== 'stub' || prompt.facts.length === 0) return null;
  const answer = seen.answer.toLowerCase();
  return bit(prompt.facts.some((fact) => answer.includes(fact.toLowerCase())));
}

/** Tools of the test node that change something; calling one unasked is a failed task. */
const CHANGING_TOOLS = ['propose', 'remember'];

function toolsServe(prompt: EvalPrompt, used: readonly string[]): boolean {
  if (prompt.tools.length === 0) return used.length === 0;
  const first = [...prompt.tools.slice(0, 1), ...(prompt.accept ?? [])];
  const unasked = used.some((t) => CHANGING_TOOLS.includes(t) && !prompt.tools.includes(t));
  const rest = prompt.tools.slice(1).every((tool) => used.includes(tool));
  return first.some((tool) => used.includes(tool)) && rest && !unasked;
}

/**
 * The task was done: a valid tool path (the expected first tool or an accepted other one, every
 * further expected tool, no changing tool nobody asked for), an answer, no error, and the
 * expected fact in the answer where facts are scored. Extra read-only calls do not fail it.
 */
export function taskDone(prompt: EvalPrompt, seen: Observation, target: string): 0 | 1 {
  const clean = !seen.timedOut && seen.errors.length === 0 && seen.answer.trim() !== '';
  const fact = factInAnswer(prompt, seen, target) !== 0;
  return bit(clean && fact && toolsServe(prompt, seen.tools));
}

function hallucinated(seen: Observation, pageTools: readonly string[]): string[] {
  const called = seen.tools.filter((tool) => !pageTools.includes(tool));
  const named = seen.errors.flatMap((e) =>
    [...e.matchAll(/unknown tool "([^"]+)"/g)].map((m) => m[1] ?? ''),
  );
  return [...new Set([...called, ...named])];
}

export function scorePrompt(prompt: EvalPrompt, seen: Observation, ctx: ScoreContext): Row {
  const error = seen.timedOut ? 'timed out' : seen.errors.at(-1);
  return {
    n: prompt.n,
    model: ctx.model,
    target: ctx.target,
    tools: seen.tools,
    toolRight: toolRight(prompt, seen),
    firstToolRight: firstToolRight(prompt, seen),
    toolUsed: toolUsed(prompt, seen),
    taskDone: taskDone(prompt, seen, ctx.target),
    gateShown: gateShown(seen),
    factInAnswer: factInAnswer(prompt, seen, ctx.target),
    hallucinated: hallucinated(seen, ctx.pageTools),
    repeated: seen.repeated,
    firstTokenS: seen.firstTokenMs === null ? null : seconds(seen.firstTokenMs),
    totalS: seconds(seen.totalMs),
    ...(error === undefined ? {} : { error }),
  };
}

export interface SummaryRow {
  readonly model: string;
  readonly target: string;
  readonly prompts: number;
  readonly toolRight: number;
  readonly firstToolRight: number;
  readonly toolUsed: string;
  readonly taskDone: number;
  readonly gateShown: string;
  readonly factInAnswer: string;
  readonly hallucinated: number;
  readonly errors: number;
  /** Prompts in which the loop refused at least one repeated call. */
  readonly repeated: number;
  readonly medianFirstTokenS: number | null;
}

const ofScored = (values: readonly (0 | 1 | null)[]): string => {
  const scored = values.filter((v) => v !== null);
  return `${scored.filter((v) => v === 1).length} of ${scored.length}`;
};

function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function summaryOf(rows: readonly Row[]): SummaryRow {
  const first = rows[0] as Row;
  return {
    model: first.model,
    target: first.target,
    prompts: rows.length,
    toolRight: rows.filter((r) => r.toolRight === 1).length,
    firstToolRight: rows.filter((r) => r.firstToolRight === 1).length,
    toolUsed: ofScored(rows.map((r) => r.toolUsed)),
    taskDone: rows.filter((r) => r.taskDone === 1).length,
    gateShown: ofScored(rows.map((r) => r.gateShown)),
    factInAnswer: ofScored(rows.map((r) => r.factInAnswer)),
    hallucinated: rows.filter((r) => r.hallucinated.length > 0).length,
    errors: rows.filter((r) => r.error !== undefined).length,
    repeated: rows.filter((r) => r.repeated > 0).length,
    medianFirstTokenS: median(rows.flatMap((r) => (r.firstTokenS === null ? [] : [r.firstTokenS]))),
  };
}

export function summarize(rows: readonly Row[]): SummaryRow[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.model}\u0000${row.target}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(summaryOf);
}
