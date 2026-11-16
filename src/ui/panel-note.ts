// SPDX-License-Identifier: Apache-2.0
import { byId } from './dom';
import { t } from './i18n';
import type { PanelController } from './panel-controller';

/** The one-line message about the last page action; the next message replaces it. */
export function note(ctx: PanelController, text: string): void {
  byId(ctx.deps.doc, 'page-note').textContent = text;
}

/** Read page text stays only while the panel works on the same tab and site. */
export function dropStalePageText(ctx: PanelController): void {
  const read = ctx.state.pageText;
  const page = ctx.state.page;
  if (!read || (read.tabId === page?.tabId && read.origin === page.origin)) return;
  ctx.state.pageText = undefined;
  note(ctx, t('siteChanged', { origin: read.origin }));
}
