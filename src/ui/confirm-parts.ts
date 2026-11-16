// SPDX-License-Identifier: Apache-2.0
// The extra lines of the question before a tool call: what the review found, and what a form
// tool means (the page waits for Submit; sensitive fields). The wording of the findings comes from
// the page's own words only through `detail`, shown as text with hidden characters made visible.
import { needsConfirmation } from '../core/gate';
import type { ToolCallApproval } from '../core/ports/chat-ui';
import { revealInvisible } from '../core/sanitize';
import { visible } from '../core/tool-card';
import { flagReason } from '../core/tool-review-text';
import type { ToolInfo } from '../core/types';
import type { Question } from './confirm-dialog';
import { element } from './dom';
import { t } from './i18n';
import { sign } from './marks';
import { sensitiveKinds } from './tool-detail';

/** "Look twice before you allow", then one line per finding; nothing for a tool without one. */
export function reviewLines(doc: Document, tool: ToolInfo): HTMLElement[] {
  const flags = tool.review ?? [];
  if (flags.length === 0) return [];
  const head = element(doc, 'p', t('confirmLook'), 'warning');
  head.prepend(sign(doc));
  const lines = flags.map((flag) => element(doc, 'p', visible(flagReason(flag)), 'hint-line'));
  return [head, ...lines];
}

/** What a form tool does: it waits for Submit, or the browser submits; the sensitive fields. */
export function formLines(doc: Document, tool: ToolInfo): HTMLElement[] {
  const form = tool.form;
  if (!form) return [];
  const sensitive = form.sensitive.length > 0;
  const kinds = sensitiveKinds(form.sensitive);
  const lines = [element(doc, 'p', t(form.autosubmit ? 'confirmFormAuto' : 'confirmFormWaits'))];
  if (sensitive) {
    const key = form.autosubmit ? 'confirmSensitiveAuto' : 'confirmSensitive';
    const warning = element(doc, 'p', t(key, { kinds }), 'warning');
    warning.prepend(sign(doc));
    lines.push(warning);
  }
  return lines;
}

/** The tool's page marked it as having consequences: it is asked about twice. */
export const needsSecondQuestion = (tool: ToolInfo): boolean =>
  tool.annotations?.consequentialHint === true;

/** "Read-only" only when the gate also treats the tool as read-only. */
function hintText(tool: ToolInfo): string {
  if (!needsConfirmation(tool)) return t('confirmReadOnly');
  return tool.annotations?.readOnlyHint === true ? t('confirmConsequential') : t('confirmChanges');
}

/**
 * The question before a tool call, the same in the side panel and in the Activity view's re-run:
 * site, review, hint, form lines and the full arguments, with hidden characters made visible.
 */
export function toolQuestion(
  doc: Document,
  request: ToolCallApproval,
  title: string = t('confirmTitle', { name: revealInvisible(request.tool.name) }),
): Question {
  const hint = element(doc, 'p', hintText(request.tool));
  if (needsConfirmation(request.tool)) {
    hint.classList.add('warning');
    hint.prepend(sign(doc));
  }
  return {
    title,
    body: [
      element(doc, 'p', t('confirmSite', { origin: revealInvisible(request.origin) })),
      ...reviewLines(doc, request.tool),
      hint,
      ...formLines(doc, request.tool),
      element(doc, 'p', t('confirmArgs')),
      element(doc, 'pre', revealInvisible(JSON.stringify(request.args, null, 2))),
    ],
    allowLabel: t('allowOnce'),
    denyLabel: t('deny'),
  };
}

/** Asked after the first Allow for a tool the page marks as consequential. */
export function againQuestion(doc: Document, tool: ToolInfo): Question {
  const warning = element(doc, 'p', t('againBody'), 'warning');
  warning.prepend(sign(doc));
  return {
    title: t('againTitle', { name: revealInvisible(tool.name) }),
    body: [warning],
    allowLabel: t('againAllow'),
    denyLabel: t('deny'),
  };
}
