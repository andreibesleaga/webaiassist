// SPDX-License-Identifier: Apache-2.0
// What the Activity tab draws: the totals table and the list of questions with their tool calls and
// context numbers. Every value is put in with textContent; a model name, a site or a tool name can
// come from a page or a service and stays text.
import { totals, totalsByDay, type Totals } from '../../core/activity-summary';
import type { QuestionRecord, ToolCall } from '../../core/ports/activity-log';
import { element } from '../dom';
import { t } from '../i18n';
import type { MessageKey } from '../messages-en';

const ARGS_SHOWN = 200;

function cell(doc: Document, tag: 'th' | 'td', text: string, scope?: 'col' | 'row'): HTMLElement {
  const node = element(doc, tag, text);
  if (scope) node.setAttribute('scope', scope);
  return node;
}

function head(doc: Document, keys: readonly MessageKey[]): HTMLElement {
  const row = element(doc, 'tr');
  for (const key of keys) row.append(cell(doc, 'th', t(key), 'col'));
  const section = element(doc, 'thead');
  section.append(row);
  return section;
}

const seconds = (ms: number): string => t('activitySeconds', { seconds: (ms / 1000).toFixed(1) });

function priceText(sum: Pick<Totals, 'costKind' | 'costUsd' | 'unpriced'>): string {
  const amount = sum.costUsd.toFixed(4);
  if (sum.costKind === 'none') return t('activityPriceNone');
  if (sum.costKind === 'unknown') return t('activityPriceUnknown');
  return sum.unpriced > 0
    ? t('activityPriceUnpriced', { amount, count: sum.unpriced })
    : t('activityPriceReported', { amount });
}

function tokensText(sum: Totals): string {
  const count = sum.promptTokens + sum.completionTokens;
  return sum.estimated ? t('activityEstimated', { count }) : String(count);
}

function totalsRow(doc: Document, label: string, sum: Totals): HTMLElement {
  const row = element(doc, 'tr');
  row.append(
    cell(doc, 'th', label, 'row'),
    cell(doc, 'td', String(sum.questions)),
    cell(doc, 'td', String(sum.toolCalls)),
    cell(doc, 'td', tokensText(sum)),
    cell(doc, 'td', priceText(sum)),
    cell(doc, 'td', seconds(sum.totalMs)),
  );
  return row;
}

/** The totals of `shown`: one row for all days, then one per day. */
export function totalsTable(doc: Document, shown: readonly QuestionRecord[]): HTMLElement {
  const table = element(doc, 'table');
  table.id = 'activity-totals';
  table.setAttribute('aria-label', t('activityTotalsLabel'));
  const body = element(doc, 'tbody');
  body.append(totalsRow(doc, t('activityAllDays'), totals(shown)));
  for (const day of totalsByDay(shown)) body.append(totalsRow(doc, day.day, day.totals));
  const keys: MessageKey[] = [
    'activityColDay',
    'activityColQuestions',
    'activityColToolCalls',
    'activityColTokens',
    'activityColPrice',
    'activityColTime',
  ];
  table.append(head(doc, keys), body);
  return table;
}

const OUTCOME: Record<QuestionRecord['outcome'], MessageKey> = {
  answered: 'activityOutcomeAnswered',
  stopped: 'activityOutcomeStopped',
  'step-limit': 'activityOutcomeStepLimit',
  error: 'activityOutcomeError',
};
const DECISION: Record<ToolCall['decision'], MessageKey> = {
  allowed: 'activityDecisionAllowed',
  denied: 'activityDecisionDenied',
  'not-asked': 'activityDecisionNotAsked',
};

/** One line about a tool call, without its buttons. */
export function toolLine(call: ToolCall): string {
  const parts = [
    t(DECISION[call.decision]),
    call.ok === undefined ? '' : t(call.ok ? 'activityToolOk' : 'activityToolFailed'),
    call.durationMs === undefined ? '' : seconds(call.durationMs),
  ].filter((part) => part !== '');
  return `${call.name}${call.builtin ? t('activityBuiltin') : ''}: ${parts.join(', ')}`;
}

export function toolItem(doc: Document, call: ToolCall): HTMLElement {
  const item = element(doc, 'li', toolLine(call));
  if (call.args !== undefined) {
    const args = JSON.stringify(call.args).slice(0, ARGS_SHOWN);
    item.append(element(doc, 'br'), element(doc, 'code', t('activityArgsText', { text: args })));
  }
  return item;
}

function contextMeter(doc: Document, record: QuestionRecord): HTMLElement {
  const { instructions, tools, site, chat, reply } = record.context;
  const used = instructions + tools + site + chat + reply;
  const meter = element(doc, 'meter', `${used} / ${record.windowTokens}`);
  meter.min = 0;
  meter.max = record.windowTokens;
  meter.value = used;
  meter.setAttribute(
    'aria-label',
    t('activityContextLabel', { used, window: record.windowTokens }),
  );
  return meter;
}

/** The cells of one question, the tool calls cell last (the caller fills it). */
export function questionRow(doc: Document, record: QuestionRecord): HTMLTableRowElement {
  const row = element(doc, 'tr');
  const result = cell(doc, 'td', t(OUTCOME[record.outcome]));
  if (record.text !== undefined) {
    result.append(element(doc, 'br'), t('activityQuestionText', { text: record.text }));
  }
  const tokens = record.promptTokens + record.completionTokens;
  const context = element(doc, 'td');
  context.append(contextMeter(doc, record));
  row.append(
    cell(doc, 'th', `${record.at.slice(0, 19).replace('T', ' ')}`, 'row'),
    cell(doc, 'td', record.origin),
    cell(doc, 'td', record.model),
    result,
    cell(
      doc,
      'td',
      record.tokensEstimated ? t('activityEstimated', { count: tokens }) : String(tokens),
    ),
    cell(
      doc,
      'td',
      priceText({
        costKind: record.cost.kind,
        costUsd: record.cost.usd ?? 0,
        unpriced: 0,
      }),
    ),
    context,
  );
  return row;
}

export function entriesTable(doc: Document): { table: HTMLElement; body: HTMLElement } {
  const table = element(doc, 'table');
  const body = element(doc, 'tbody');
  const keys: MessageKey[] = [
    'activityColTimeUtc',
    'activityColSite',
    'activityColModel',
    'activityColResult',
    'activityColTokens',
    'activityColPrice',
    'activityColContext',
    'activityColTools',
  ];
  table.append(head(doc, keys), body);
  return { table, body };
}
