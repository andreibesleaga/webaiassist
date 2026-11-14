// SPDX-License-Identifier: Apache-2.0
// The Query tab: a plain text box for a read-only SPARQL query, Run and Stop, one status line, the
// result as a table (result-table.ts, text only), and the example questions with "Put in editor".
// The query runs in the query worker over the node's own graph.nq; nothing is sent anywhere.
import type { RunOutcome } from '../../adapters/query-session';
import { EXAMPLES, FIRST_QUERY } from '../../query/examples';
import { QUERY_LIMITS, type QueryReply } from '../../query/protocol';
import { element } from '../dom';
import { t } from '../i18n';
import { renderResult } from './result-table';
import type { ExplorerContext, ExplorerTab, QueryTabDeps } from './tabs';

interface Parts {
  readonly editor: HTMLTextAreaElement;
  readonly run: HTMLButtonElement;
  readonly stop: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly result: HTMLElement;
}

function replyText(reply: QueryReply): string {
  if (reply.error !== undefined || reply.json === undefined) return reply.error ?? '';
  if (reply.form !== 'ASK')
    return t('queryAnswered', { form: reply.form ?? '', count: reply.total ?? 0 });
  const yes = (JSON.parse(reply.json) as { boolean?: boolean }).boolean === true;
  return t('queryAnsweredAsk', { answer: yes ? 'yes' : 'no' });
}

/** The sentence under the box for one outcome. */
export function statusText(outcome: RunOutcome): string {
  if (outcome.kind === 'timeout') return t('queryTimedOut', { seconds: QUERY_LIMITS.tabMs / 1000 });
  if (outcome.kind === 'stopped') return t('queryStopped');
  if (outcome.kind === 'failed') return outcome.text;
  return replyText(outcome.reply);
}

function show(doc: Document, parts: Parts, outcome: RunOutcome): void {
  parts.status.textContent = statusText(outcome);
  parts.result.replaceChildren();
  if (outcome.kind !== 'answer' || outcome.reply.json === undefined) return;
  const total = outcome.reply.total ?? 0;
  const shown = Math.min(total, QUERY_LIMITS.tabRows);
  const caption =
    total > shown
      ? t('queryCaption', { count: total, shown })
      : t('queryCaptionAll', { count: total });
  parts.result.append(renderResult(doc, outcome.reply.json, QUERY_LIMITS.tabRows, caption));
}

async function run(doc: Document, parts: Parts, deps: QueryTabDeps): Promise<void> {
  parts.run.disabled = true;
  parts.stop.disabled = false;
  parts.status.textContent = t('queryLoading');
  parts.result.replaceChildren();
  const outcome = await deps.graph.run(parts.editor.value, {
    maxRows: QUERY_LIMITS.tabRows,
    ms: QUERY_LIMITS.tabMs,
  });
  show(doc, parts, outcome);
  parts.run.disabled = false;
  parts.stop.disabled = true;
}

function controls(doc: Document, root: HTMLElement): Parts {
  const label = element(doc, 'label', t('queryEditorLabel'));
  label.htmlFor = 'query-editor';
  const editor = element(doc, 'textarea');
  editor.id = 'query-editor';
  editor.rows = 10;
  editor.spellcheck = false;
  editor.autocomplete = 'off';
  editor.value = FIRST_QUERY;
  const run = element(doc, 'button', t('queryRun'));
  run.type = 'button';
  run.id = 'query-run';
  const stop = element(doc, 'button', t('queryStop'));
  stop.type = 'button';
  stop.id = 'query-stop';
  stop.disabled = true;
  const status = element(doc, 'p', t('queryReady'), 'query-status');
  status.id = 'query-status';
  status.setAttribute('role', 'status');
  const result = element(doc, 'div', undefined, 'query-result');
  const buttons = element(doc, 'div', undefined, 'query-buttons');
  buttons.append(run, stop);
  root.append(label, editor, buttons, status, result);
  return { editor, run, stop, status, result };
}

function examples(doc: Document, root: HTMLElement, parts: Parts): void {
  const heading = element(doc, 'h3', t('queryExamplesHeading'));
  const note = element(doc, 'p', t('queryExamplesNote'), 'muted');
  const list = element(doc, 'ul', undefined, 'query-examples');
  for (const example of EXAMPLES) {
    const item = element(doc, 'li');
    const button = element(doc, 'button', t('queryPut'));
    button.type = 'button';
    button.setAttribute('aria-label', t('queryPutLabel', { question: example.question }));
    button.addEventListener('click', () => {
      parts.editor.value = example.sparql;
      parts.editor.focus();
    });
    item.append(element(doc, 'span', `${example.question} `), button);
    list.append(item);
  }
  root.append(heading, note, list);
}

export function renderQueryTab(root: HTMLElement, ctx: ExplorerContext, deps: QueryTabDeps): void {
  const doc = ctx.doc;
  root.append(element(doc, 'h2', t('queryHeading')), element(doc, 'p', t('queryIntro'), 'muted'));
  const parts = controls(doc, root);
  parts.run.addEventListener('click', () => void run(doc, parts, deps));
  parts.stop.addEventListener('click', () => deps.graph.stop());
  examples(doc, root, parts);
}

export const queryTab: ExplorerTab = {
  id: 'query',
  labelKey: 'explorerTabQuery',
  mount: (root, ctx) => {
    if (ctx.query) renderQueryTab(root, ctx, ctx.query);
  },
};
