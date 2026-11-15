// SPDX-License-Identifier: Apache-2.0
// The extra lines of the question before a tool call: what the review found, and what a form
// tool means (the page waits for Submit; sensitive fields). The wording of the findings comes from
// the page's own words only through `detail`, shown as text with hidden characters made visible.
import { visible } from '../core/tool-card';
import { flagReason } from '../core/tool-review-text';
import type { ToolInfo } from '../core/types';
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
