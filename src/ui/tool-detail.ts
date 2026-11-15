// SPDX-License-Identifier: Apache-2.0
// The detail view of one tool: everything the page said about it (title, description, the four
// hints, the fields), the form facts, and why the review marked it. All of it comes from the
// page, so every value is set as text and shown with hidden characters made visible.
import { argsTemplate } from '../core/args-template';
import { visible } from '../core/tool-card';
import { flagReason } from '../core/tool-review-text';
import type { ToolInfo } from '../core/types';
import { element } from './dom';
import { t } from './i18n';
import type { MessageKey } from './messages-en';

/** Runs a tool by hand with the text the user typed; `say` shows a plain line under the box. */
export type RunByHand = (tool: ToolInfo, argsText: string, say: (line: string) => void) => void;

const SCHEMA_CAP = 4000;
const TEXT_CAP = 4000;

const cut = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;

function labelled(doc: Document, label: MessageKey, body: Node): HTMLElement {
  const block = element(doc, 'div', undefined, 'detail-part');
  block.append(element(doc, 'strong', t(label)), body);
  return block;
}

const pre = (doc: Document, text: string): HTMLElement =>
  element(doc, 'pre', cut(visible(text), SCHEMA_CAP));

const para = (doc: Document, text: string, className?: string): HTMLElement =>
  element(doc, 'p', cut(visible(text), TEXT_CAP), className);

function hintLine(doc: Document, key: MessageKey, value: boolean | undefined): HTMLElement {
  const word = value === undefined ? t('hintNotGiven') : t(value ? 'hintYes' : 'hintNo');
  return element(doc, 'p', t(key, { value: word }), 'hint-line');
}

function hints(doc: Document, tool: ToolInfo): HTMLElement {
  const given = tool.annotations;
  const body = element(doc, 'div');
  body.append(
    hintLine(doc, 'hintReadOnly', given?.readOnlyHint),
    hintLine(doc, 'hintConsequential', given?.consequentialHint),
    hintLine(doc, 'hintUntrusted', given?.untrustedContentHint),
    hintLine(doc, 'hintDebugging', given?.debugging),
  );
  return body;
}

const SENSITIVE: Record<string, MessageKey> = {
  password: 'sensitivePassword',
  payment: 'sensitivePayment',
  personal: 'sensitivePersonal',
};

/** "password and payment": the kinds of sensitive field, in words. */
export function sensitiveKinds(kinds: readonly string[]): string {
  return kinds.map((kind) => t(SENSITIVE[kind] ?? 'sensitivePersonal')).join(', ');
}

function formPart(doc: Document, tool: ToolInfo): HTMLElement | undefined {
  const form = tool.form;
  if (!form) return undefined;
  const body = element(doc, 'div');
  body.append(para(doc, t(form.autosubmit ? 'formAutoDetail' : 'formWaitsDetail')));
  if (form.sensitive.length > 0) {
    body.append(para(doc, t('formSensitiveDetail', { kinds: sensitiveKinds(form.sensitive) })));
  }
  return labelled(doc, 'detailForm', body);
}

function reviewPart(doc: Document, tool: ToolInfo): HTMLElement | undefined {
  if (!tool.review || tool.review.length === 0) return undefined;
  const body = element(doc, 'div');
  for (const flag of tool.review) body.append(para(doc, flagReason(flag), 'hint-line'));
  return labelled(doc, 'detailReview', body);
}

/** The box and button to run the tool by hand; the text is checked before anything is asked. */
function runPart(doc: Document, tool: ToolInfo, run: RunByHand, saved?: string): HTMLElement {
  const box = element(doc, 'textarea');
  box.rows = 3;
  box.spellcheck = false;
  box.value = saved ?? argsTemplate(tool.inputSchema);
  box.setAttribute('aria-label', t('runArgsLabel'));
  const line = element(doc, 'p', undefined, 'hint run-line');
  line.setAttribute('role', 'status');
  const button = element(doc, 'button', t('runButton'));
  button.type = 'button';
  button.addEventListener('click', () => run(tool, box.value, (text) => (line.textContent = text)));
  const part = element(doc, 'div', undefined, 'detail-part run-part');
  part.append(
    element(doc, 'strong', t('runHeading')),
    element(doc, 'p', t('runHelp'), 'hint'),
    box,
    button,
    line,
  );
  return part;
}

/** The pane under a tool's row. `saved` is the text the user had typed before a redraw. */
export function toolDetail(
  doc: Document,
  tool: ToolInfo,
  run: RunByHand | undefined,
  saved?: string,
): HTMLElement {
  const pane = element(doc, 'div', undefined, 'detail');
  const schema =
    tool.inputSchema === undefined ? t('detailNone') : JSON.stringify(tool.inputSchema, null, 2);
  const parts = [
    labelled(doc, 'detailName', para(doc, tool.name)),
    labelled(doc, 'detailTitle', para(doc, tool.title ?? t('detailNone'))),
    labelled(doc, 'detailDescription', para(doc, tool.description || t('detailNoDescription'))),
    labelled(doc, 'detailHints', hints(doc, tool)),
    labelled(doc, 'detailSchema', pre(doc, schema)),
    formPart(doc, tool),
    reviewPart(doc, tool),
    run ? runPart(doc, tool, run, saved) : undefined,
  ];
  pane.append(...parts.filter((part): part is HTMLElement => part !== undefined));
  return pane;
}
