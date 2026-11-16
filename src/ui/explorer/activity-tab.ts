// SPDX-License-Identifier: Apache-2.0
// The Activity tab of the explorer page: totals, filters by site, model and day, the list of
// questions with their tool calls and context numbers, the "include content" switch, the two
// exports, Clear (asked inside the page) and a re-run of a past tool call that goes through the
// normal question. It works on any page, also when no node is open (explorer.html?view=activity).
import { activityCsv, activityJson } from '../../core/activity-export';
import { choices, filterRecords, type Filter } from '../../core/activity-summary';
import type { ActivityLog, QuestionRecord } from '../../core/ports/activity-log';
import type { SiteGrants } from '../../core/ports/site-grants';
import type { ToolBridge } from '../../core/ports/tool-bridge';
import { element } from '../dom';
import type { ExplorerTarget } from '../explorer-url';
import { t } from '../i18n';
import { createAsker } from './activity-ask';
import { rerunButton } from './activity-rerun-ui';
import { entriesTable, questionRow, toolItem, totalsTable } from './activity-view';

export interface ActivityDeps {
  readonly log: ActivityLog;
  /** What a past call is run through; without it, and without `target`, nothing is run again. */
  readonly bridge?: ToolBridge;
  /** The sites allowed in this session (the side panel asks); a re-run never runs on any other. */
  readonly grants?: Pick<SiteGrants, 'has'>;
  /** The tab and site the page was opened for (the panel's page); re-runs go there only. */
  readonly target?: ExplorerTarget;
  nowIso(): string;
  download(fileName: string, text: string, mime: string): void;
}

export interface ActivityContext {
  readonly doc: Document;
  readonly activity?: ActivityDeps;
}

interface Parts {
  readonly doc: Document;
  readonly deps: ActivityDeps;
  readonly totals: HTMLElement;
  readonly list: HTMLElement;
  readonly ask: HTMLElement;
  readonly rerunResult: HTMLElement;
  readonly selects: Record<keyof Filter, HTMLSelectElement>;
  all: readonly QuestionRecord[];
}

const FILTERS: readonly [
  keyof Filter,
  'activityFilterSite' | 'activityFilterModel' | 'activityFilterDay',
][] = [
  ['origin', 'activityFilterSite'],
  ['model', 'activityFilterModel'],
  ['day', 'activityFilterDay'],
];

function currentFilter(parts: Parts): Filter {
  const pick = (key: keyof Filter): Filter =>
    parts.selects[key].value === '' ? {} : { [key]: parts.selects[key].value };
  return { ...pick('origin'), ...pick('model'), ...pick('day') };
}

function shown(parts: Parts): QuestionRecord[] {
  return filterRecords(parts.all, currentFilter(parts));
}

function fillSelect(parts: Parts, key: keyof Filter, values: readonly string[]): void {
  const select = parts.selects[key];
  const keep = select.value;
  const all = element(parts.doc, 'option', t('activityFilterAll'));
  all.value = '';
  select.replaceChildren(all);
  for (const value of values) {
    const option = element(parts.doc, 'option', value);
    option.value = value;
    select.append(option);
  }
  select.value = values.includes(keep) ? keep : '';
}

function toolsCell(parts: Parts, record: QuestionRecord): HTMLElement {
  const td = element(parts.doc, 'td');
  const list = element(parts.doc, 'ul');
  for (const call of record.tools) {
    const item = toolItem(parts.doc, call);
    const button = rerunButton(
      { doc: parts.doc, deps: parts.deps, askHost: parts.ask, out: parts.rerunResult },
      record,
      call,
    );
    if (button) item.append(' ', button);
    list.append(item);
  }
  td.append(list);
  return td;
}

function drawList(parts: Parts): void {
  const rows = shown(parts);
  parts.totals.replaceChildren(totalsTable(parts.doc, rows));
  if (rows.length === 0) {
    parts.list.replaceChildren(element(parts.doc, 'p', t('activityEmpty')));
    return;
  }
  const { table, body } = entriesTable(parts.doc);
  for (const record of [...rows].reverse()) {
    const row = questionRow(parts.doc, record);
    row.append(toolsCell(parts, record));
    body.append(row);
  }
  parts.list.replaceChildren(table);
}

function drawFilters(parts: Parts): void {
  const found = choices(parts.all);
  fillSelect(parts, 'origin', found.origins);
  fillSelect(parts, 'model', found.models);
  fillSelect(parts, 'day', found.days);
}

async function reload(parts: Parts): Promise<void> {
  parts.all = await parts.deps.log.list();
  drawFilters(parts);
  drawList(parts);
}

function filterBar(
  doc: Document,
  onChange: () => void,
): { selects: Parts['selects']; group: HTMLElement } {
  const selects = {} as Parts['selects'];
  const group = element(doc, 'div');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('activityFiltersLabel'));
  for (const [key, label] of FILTERS) {
    const select = element(doc, 'select');
    select.id = `activity-${key === 'origin' ? 'site' : key}`;
    select.addEventListener('change', onChange);
    const wrap = element(doc, 'label', `${t(label)} `);
    wrap.append(select);
    group.append(wrap, ' ');
    selects[key] = select;
  }
  return { selects, group };
}

function exportBar(parts: Parts): HTMLElement {
  const { doc, deps } = parts;
  const json = element(doc, 'button', t('activityExportJson'));
  const csv = element(doc, 'button', t('activityExportCsv'));
  const clear = element(doc, 'button', t('activityClear'));
  for (const button of [json, csv, clear]) button.type = 'button';
  json.addEventListener('click', () =>
    deps.download(
      'webaiassist-activity.json',
      activityJson(shown(parts), deps.nowIso()),
      'application/json',
    ),
  );
  csv.addEventListener('click', () =>
    deps.download('webaiassist-activity.csv', activityCsv(shown(parts)), 'text/csv'),
  );
  clear.addEventListener('click', () => void confirmClear(parts));
  const bar = element(doc, 'div', undefined, 'activity-actions');
  bar.append(json, csv, clear);
  return bar;
}

async function confirmClear(parts: Parts): Promise<void> {
  const ask = createAsker(parts.doc, parts.ask);
  const yes = await ask({
    text: t('activityClearAsk', { count: parts.all.length }),
    yes: t('activityClearYes'),
    no: t('activityClearNo'),
  });
  if (!yes) return;
  await parts.deps.log.clear();
  await reload(parts);
}

function contentSwitch(doc: Document, log: ActivityLog): HTMLElement {
  const box = element(doc, 'input');
  box.type = 'checkbox';
  box.id = 'activity-content';
  box.setAttribute('aria-describedby', 'activity-content-hint');
  void log.includeContent().then((on) => (box.checked = on));
  box.addEventListener('change', () => void log.setIncludeContent(box.checked));
  const label = element(doc, 'label');
  label.append(box, ` ${t('activityIncludeContent')}`);
  const hint = element(doc, 'p', t('activityIncludeContentHint'), 'hint');
  hint.id = 'activity-content-hint';
  const wrap = element(doc, 'div');
  wrap.append(label, hint);
  return wrap;
}

function heading(doc: Document, text: string): HTMLElement {
  return element(doc, 'h2', text);
}

function build(root: HTMLElement, doc: Document, deps: ActivityDeps): Parts {
  const { selects, group } = filterBar(doc, () => drawList(parts));
  const logRegion = element(doc, 'div');
  logRegion.setAttribute('role', 'log');
  logRegion.setAttribute('aria-label', t('activityLogLabel'));
  logRegion.tabIndex = 0;
  const parts: Parts = {
    doc,
    deps,
    selects,
    totals: element(doc, 'div'),
    list: logRegion,
    ask: element(doc, 'div'),
    rerunResult: element(doc, 'p', undefined, 'activity-result'),
    all: [],
  };
  parts.rerunResult.id = 'activity-rerun-result';
  parts.rerunResult.setAttribute('role', 'status');
  root.replaceChildren(
    heading(doc, t('activityHeading')),
    element(doc, 'p', t('activityIntro')),
    contentSwitch(doc, deps.log),
    heading(doc, t('activityTotalsHeading')),
    parts.totals,
    group,
    exportBar(parts),
    parts.ask,
    parts.rerunResult,
    heading(doc, t('activityEntriesHeading')),
    parts.list,
  );
  return parts;
}

export async function mountActivity(root: HTMLElement, ctx: ActivityContext): Promise<void> {
  if (!ctx.activity) {
    root.replaceChildren(element(ctx.doc, 'p', t('activityNeedsStore')));
    return;
  }
  const parts = build(root, ctx.doc, ctx.activity);
  await reload(parts);
}

export const activityTab = {
  id: 'activity',
  labelKey: 'explorerTabActivity',
  mount: (root: HTMLElement, ctx: ActivityContext): void => void mountActivity(root, ctx),
} as const;
