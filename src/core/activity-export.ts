// SPDX-License-Identifier: Apache-2.0
// The activity export: JSON (shape in activity-schema.ts) and CSV. Cells of the CSV that start
// with a character a spreadsheet reads as a formula are prefixed with an apostrophe, because a
// model name, an error text or a tool name can come from a page or a service.
import { totals } from './activity-summary';
import type { QuestionRecord } from './ports/activity-log';

export function activityJson(records: readonly QuestionRecord[], exportedAt: string): string {
  const doc = {
    format: 'webaiassist-activity',
    version: 1,
    exportedAt,
    totals: totals(records),
    questions: records,
  };
  return JSON.stringify(doc, null, 2);
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formula guard, then quotes when the text has a comma, quote or line break. */
export function csvCell(value: string | number | boolean | undefined): string {
  if (value === undefined) return '';
  const raw = typeof value === 'string' && FORMULA_START.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

const COLUMNS: readonly [string, (r: QuestionRecord) => string | number | boolean | undefined][] = [
  ['time', (r) => r.at],
  ['day', (r) => r.day],
  ['site', (r) => r.origin],
  ['model', (r) => r.model],
  ['place', (r) => r.place],
  ['host', (r) => r.host],
  ['window_tokens', (r) => r.windowTokens],
  ['instructions_tokens', (r) => r.context.instructions],
  ['tool_list_tokens', (r) => r.context.tools],
  ['site_tokens', (r) => r.context.site],
  ['chat_tokens', (r) => r.context.chat],
  ['reply_tokens', (r) => r.context.reply],
  ['steps', (r) => r.steps],
  ['first_word_ms', (r) => r.firstTokenMs],
  ['total_ms', (r) => r.totalMs],
  ['outcome', (r) => r.outcome],
  ['error', (r) => r.error],
  ['prompt_tokens', (r) => r.promptTokens],
  ['completion_tokens', (r) => r.completionTokens],
  ['tokens_estimated', (r) => r.tokensEstimated],
  ['cost_kind', (r) => r.cost.kind],
  ['cost_usd', (r) => r.cost.usd],
  ['tool_calls', (r) => r.tools.length],
  ['tools', (r) => r.tools.map((t) => `${t.name}:${t.decision}`).join(' ')],
  ['question', (r) => r.text],
];

export function activityCsv(records: readonly QuestionRecord[]): string {
  const header = COLUMNS.map(([name]) => name).join(',');
  const rows = records.map((r) => COLUMNS.map(([, pick]) => csvCell(pick(r))).join(','));
  return [header, ...rows].join('\r\n');
}
