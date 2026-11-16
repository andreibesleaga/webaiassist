// SPDX-License-Identifier: Apache-2.0
// The eval's output: docs/eval/EVAL-<date>-<chrome>.json with every row, and the generated
// block of docs/EVAL.md (between the eval-results markers) with the summary tables.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Row, SummaryRow } from './score.ts';

export interface ModelLine {
  readonly key: string;
  readonly id: string;
  readonly ready: boolean;
  readonly loadS: number | null;
  /** The panel's model line at the end of Start: where the model runs, or the error. */
  readonly status: string;
}

/** A model whose part of the run threw (a page that never loaded, a hung browser): it is kept
 *  in the report as not ready with the first line of the error, and the next model runs. */
export function stoppedModel(key: string, error: unknown): ModelLine {
  const text = error instanceof Error ? error.message : String(error);
  return { key, id: key, ready: false, loadS: null, status: `Stopped: ${text.split('\n')[0]}` };
}

export interface CheckResult {
  readonly name: string;
  readonly result: 'pass' | 'fail' | 'skipped' | 'review';
  readonly detail: string;
}

export interface EvalReport {
  readonly date: string;
  readonly chrome: string;
  readonly os: string;
  readonly scripted: boolean;
  readonly webgpu: { readonly panelAdapter: boolean };
  readonly models: readonly ModelLine[];
  readonly targets: readonly {
    name: string;
    url: string;
    tools: readonly string[];
    skipped?: string;
  }[];
  readonly rows: readonly Row[];
  readonly summary: readonly SummaryRow[];
  readonly checks: readonly CheckResult[];
  readonly manual: readonly string[];
}

const START = '<!-- eval-results:start -->';
const END = '<!-- eval-results:end -->';

export const reportName = (r: EvalReport): string =>
  `EVAL-${r.date}-${r.chrome}${r.scripted ? '-scripted' : ''}.json`;

export function writeReport(dir: string, report: EvalReport): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, reportName(report));
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}

const text = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return (value as string | number | boolean | bigint | symbol).toString();
};
const cell = (value: unknown): string => text(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|');
const line = (cells: readonly unknown[]): string => `| ${cells.map(cell).join(' | ')} |`;
const table = (head: readonly string[], rows: readonly (readonly unknown[])[]): string[] => [
  line(head),
  line(head.map(() => '---')),
  ...rows.map(line),
];

const SUMMARY_HEAD = [
  'Model',
  'Target',
  'Prompts',
  'Tool right',
  'First tool right',
  'Tool used',
  'Task done',
  'Gate shown',
  'Fact in answer',
  'Hallucinated',
  'Errors',
  'Repeated calls',
  'Median first token (s)',
];
const summaryRows = (r: EvalReport): (readonly unknown[])[] =>
  r.summary.map((s) => [
    s.model,
    s.target,
    s.prompts,
    s.toolRight,
    s.firstToolRight,
    s.toolUsed,
    s.taskDone,
    s.gateShown,
    s.factInAnswer,
    s.hallucinated,
    s.errors,
    s.repeated,
    s.medianFirstTokenS,
  ]);

export function renderResults(r: EvalReport, reportPath: string): string {
  const gpu = r.webgpu.panelAdapter ? 'yes' : 'no';
  const head = `Last run: ${r.date}, Chrome ${r.chrome}, ${r.os}; WebGPU adapter: ${gpu}; report \`${reportPath}\`.`;
  return [
    head + (r.scripted ? ' Scripted test model (flow check, not a model result).' : ''),
    '',
    ...table(SUMMARY_HEAD, summaryRows(r)),
    '',
    ...table(
      ['Model', 'Ready', 'Start (s)', 'Model line after Start'],
      r.models.map((m) => [m.key, m.ready ? 'yes' : 'no', m.loadS, m.status]),
    ),
    '',
    ...table(
      ['Check', 'Result', 'Detail'],
      r.checks.map((c) => [c.name, c.result, c.detail]),
    ),
  ].join('\n');
}

export function fillEvalMd(md: string, block: string): string {
  const start = md.indexOf(START);
  const end = md.indexOf(END);
  if (start === -1 || end < start) throw new Error('docs/EVAL.md has no eval-results markers');
  return `${md.slice(0, start + START.length)}\n${block}\n${md.slice(end)}`;
}
