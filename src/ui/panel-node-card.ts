// SPDX-License-Identifier: Apache-2.0
// Panel wiring of package P7d: draws the node card and the help screen from the panel's state,
// and binds the developer "Copy report" (preview first, copy on the second click).
import { toolReport } from '../core/tool-report';
import { byId } from './dom';
import { t } from './i18n';
import { helpKindFor, renderHelp, renderNodeCard, type CopyText } from './node-card';
import type { PanelController } from './panel-controller';
import { note } from './panel-note';

function copier(ctx: PanelController): CopyText {
  return (text, done) => {
    ctx.deps.copyText(text).then(
      () => note(ctx, done),
      (error: unknown) => note(ctx, t('reportFailed', { why: String(error) })),
    );
  };
}

/** Called from drawPage: the node card on a node, a help screen on a page with no tools. */
export function drawNodeCard(ctx: PanelController, node: boolean, blocked: boolean): void {
  const copy = copier(ctx);
  const info = ctx.state.page?.info;
  const facts = ctx.state.site?.facts?.node;
  renderNodeCard(
    ctx.deps.doc,
    node && !blocked ? { specVersion: facts?.specVersion } : undefined,
    copy,
  );
  renderHelp(ctx.deps.doc, info && !blocked ? helpKindFor(info) : undefined, copy);
}

export function bindReport(ctx: PanelController): void {
  const doc = ctx.deps.doc;
  const button = byId<HTMLButtonElement>(doc, 'copy-report');
  const box = byId(doc, 'report-box');
  const preview = byId(doc, 'report-preview');
  const idle = button.textContent;
  const reset = (): void => {
    box.hidden = true;
    button.textContent = idle;
  };
  button.addEventListener('click', () => {
    if (!box.hidden) {
      reset();
      ctx.deps.copyText(preview.textContent).then(
        () => note(ctx, t('reportCopied')),
        (error: unknown) => note(ctx, t('reportFailed', { why: String(error) })),
      );
      return;
    }
    const info = ctx.state.page?.info;
    if (!info) return note(ctx, t('reportNoPage'));
    preview.textContent = toolReport(info.tools);
    box.hidden = false;
    button.textContent = t('reportCopy');
  });
}
