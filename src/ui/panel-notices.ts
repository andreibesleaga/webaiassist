// SPDX-License-Identifier: Apache-2.0
// The two notices of the side panel that are not about one page: the welcome screen of the first
// run (until "Got it" or a first question; it stays hidden after that) and the offline note.
import { byId } from './dom';
import type { PanelController } from './panel-controller';

function setFirstRun(ctx: PanelController, shown: boolean): void {
  byId(ctx.deps.doc, 'first-run').hidden = !shown;
}

/** Shows the welcome screen again (Help does this); it does not change what is stored. */
export function showWelcome(ctx: PanelController): void {
  setFirstRun(ctx, true);
}

/** Closing Help hides the welcome screen it brought back, unless it was never answered. */
export function hideWelcomeAfterHelp(ctx: PanelController): void {
  if (ctx.state.persisted.firstRunDone) setFirstRun(ctx, false);
}

/** Hides the welcome screen, and for good the first time. */
export function dismissFirstRun(ctx: PanelController): void {
  setFirstRun(ctx, false);
  if (ctx.state.persisted.firstRunDone) return;
  ctx.state.persisted = { ...ctx.state.persisted, firstRunDone: true };
  void ctx.deps.saveState({ firstRunDone: true }).catch(() => undefined);
}

function bindFirstRun(ctx: PanelController): void {
  const doc = ctx.deps.doc;
  byId(doc, 'first-run-ok').addEventListener('click', () => {
    dismissFirstRun(ctx);
    byId(doc, 'question').focus();
  });
  byId(doc, 'first-run-other').addEventListener('click', () => {
    dismissFirstRun(ctx);
    byId(doc, 'model').focus();
  });
  if (ctx.state.persisted.firstRunDone) return;
  setFirstRun(ctx, true);
  byId(doc, 'first-run-title').focus();
}

function bindOffline(ctx: PanelController): void {
  const doc = ctx.deps.doc;
  const show = (): void => {
    byId(doc, 'offline-banner').hidden = ctx.deps.isOnline();
  };
  doc.defaultView?.addEventListener('online', show);
  doc.defaultView?.addEventListener('offline', show);
  show();
}

export function bindNotices(ctx: PanelController): void {
  bindFirstRun(ctx);
  bindOffline(ctx);
}
