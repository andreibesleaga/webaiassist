// SPDX-License-Identifier: Apache-2.0
// One row of the tools list: the name (a button that opens the detail view), the marks, and one
// line of what the tool does. The marks come from the page's hints and from the review; the
// words of the page are text only. A redraw keeps the rows that were open, and what was typed.
import type { ToolRow } from '../core/tool-card';
import { flagReason } from '../core/tool-review-text';
import { element } from './dom';
import { t } from './i18n';
import { sign } from './marks';
import { toolDetail, type RunByHand } from './tool-detail';

/** What a redraw must not lose: the rows that are open, and the text typed in their boxes. */
export type OpenRows = ReadonlyMap<string, string | undefined>;

function mark(doc: Document, key: Parameters<typeof t>[0], className: string, title?: string) {
  const node = element(doc, 'span', t(key), `mark ${className}`);
  if (title !== undefined) node.title = title;
  return node;
}

function effectMarks(doc: Document, row: ToolRow): HTMLElement[] {
  const effect = mark(doc, row.effect === 'reads' ? 'toolReads' : 'toolChanges', row.effect);
  if (row.unmarked) effect.title = t('toolUnmarked');
  const marks = row.effect === 'changes' ? [sign(doc), effect] : [effect];
  if (row.unmarked) marks.push(mark(doc, 'toolNotMarked', 'unmarked'));
  return marks;
}

function extraMarks(doc: Document, row: ToolRow): HTMLElement[] {
  const marks: HTMLElement[] = [];
  if (row.pageContent) marks.push(mark(doc, 'toolPageContent', 'page', t('toolPageContentTitle')));
  if (row.reserved) marks.push(mark(doc, 'toolReserved', 'reserved'));
  if (row.forDevelopers)
    marks.push(mark(doc, 'toolForDevelopers', 'developers', t('toolForDevelopersTitle')));
  if (row.source.form) marks.push(mark(doc, 'toolForm', 'form', t('toolFormTitle')));
  if (row.flags.length > 0) marks.push(mark(doc, 'toolCheck', 'check', t('toolCheckTitle')));
  return marks;
}

/** The name as a button: it opens and closes the detail view of the tool. */
function nameButton(doc: Document, row: ToolRow): HTMLButtonElement {
  const button = element(doc, 'button', undefined, 'open');
  button.type = 'button';
  button.append(element(doc, 'code', row.name));
  button.setAttribute('aria-label', t('toolOpen', { name: row.name }));
  button.setAttribute('aria-expanded', 'false');
  return button;
}

function flagLines(doc: Document, row: ToolRow): HTMLElement[] {
  return row.flags.map((flag) => element(doc, 'span', flagReason(flag), 'why'));
}

export function toolItem(
  doc: Document,
  row: ToolRow,
  run: RunByHand | undefined,
  open: OpenRows,
): HTMLLIElement {
  const item = element(doc, 'li');
  item.dataset.trust = 'untrusted';
  item.dataset.tool = row.name;
  const marks = element(doc, 'span', undefined, 'marks');
  marks.append(...effectMarks(doc, row), ...extraMarks(doc, row));
  const what = element(doc, 'span', row.summary, 'what');
  what.title = row.detail;
  const button = nameButton(doc, row);
  item.append(button, marks, what, ...flagLines(doc, row));
  const show = (saved?: string): void => {
    item.append(toolDetail(doc, row.source, row.reserved ? undefined : run, saved));
    button.setAttribute('aria-expanded', 'true');
  };
  const hide = (): void => {
    item.querySelector('.detail')?.remove();
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', () => (item.querySelector('.detail') ? hide() : show()));
  if (open.has(row.name)) show(open.get(row.name));
  return item;
}

/** The rows that are open now and the text typed in their boxes, read from the list before a redraw. */
export function openRows(list: ParentNode): OpenRows {
  const out = new Map<string, string | undefined>();
  list.querySelectorAll<HTMLElement>('li[data-tool]').forEach((item) => {
    if (!item.querySelector('.detail')) return;
    out.set(item.dataset.tool ?? '', item.querySelector('textarea')?.value);
  });
  return out;
}
