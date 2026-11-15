// SPDX-License-Identifier: Apache-2.0
// Side panel actions about the open page: its status line and Allow button, "Read this
// page", compat mode, "Forget this site", Export, Help and Options. Messages about the last
// action go to one line (#page-note), each replacing the one before. Read page text is kept
// with the tab and site it came from, and dropped when the panel moves to another tab or site.
import type { AllowResult } from '../adapters/site-access';
import { exportMarkdown } from '../core/export';
import { PAGE_TEXT_TOOL } from '../core/untrusted';
import { byId } from './dom';
import { endpointHost } from './endpoint-host';
import { t } from './i18n';
import type { PanelController } from './panel-controller';
import { bindToolsToggle } from './page-card';
import { bindPanelDiagnostics } from './panel-diagnostics';
import { bindReport } from './panel-node-card';
import { note } from './panel-note';
import { hideWelcomeAfterHelp, showWelcome } from './panel-notices';
import { aiBlocked, overrideAiPolicy, refreshPage } from './panel-page';

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export { note };
export { refreshPage };

const ALLOW_TEXT = {
  denied: 'allowDenied',
  requested: 'allowRequested',
  toolbar: 'allowToolbar',
} as const;

async function afterAllow(ctx: PanelController, tabId: number, result: AllowResult) {
  if (result !== 'granted') return note(ctx, t(ALLOW_TEXT[result]));
  await refreshPage(ctx, tabId);
  const origin = ctx.state.page?.origin;
  if (origin !== undefined) note(ctx, t('allowGranted', { host: new URL(origin).host }));
}

/** Synchronous up to allowSite, so the permission request keeps the click's gesture. */
function allow(ctx: PanelController): void {
  const page = ctx.state.page;
  if (page === undefined) return note(ctx, t('noTab'));
  const origin = page.origin === undefined ? {} : { origin: page.origin };
  ctx.deps
    .allowSite({ tabId: page.tabId, ...origin })
    .then((result) => afterAllow(ctx, page.tabId, result))
    .catch((error: unknown) => note(ctx, errorText(error)));
}

async function readPage(ctx: PanelController): Promise<void> {
  if (aiBlocked(ctx)) return note(ctx, t('pageBlockedRead'));
  const tabId = ctx.state.page?.tabId ?? (await ctx.deps.targetTab());
  if (tabId === undefined) return note(ctx, t('noTab'));
  try {
    const snapshot = await ctx.deps.readPage(tabId);
    ctx.state.pageText = { tabId, origin: snapshot.origin, text: snapshot.text };
    ctx.ui.show({ kind: 'tool-result', name: PAGE_TEXT_TOOL, ok: true, text: snapshot.text });
    note(ctx, t('pageRead', { count: snapshot.text.length }));
  } catch (error) {
    note(ctx, errorText(error));
  }
}

const COMPAT_TEXT = {
  enabled: 'compatEnabled',
  already: 'compatAlready',
  denied: 'compatDenied',
} as const;

/** Synchronous up to enableCompat, so the permission request keeps the click's gesture. */
function compat(ctx: PanelController): void {
  const page = ctx.state.page;
  if (page?.origin === undefined) return note(ctx, t('compatNoSite'));
  const origin = page.origin;
  ctx.deps
    .enableCompat({ tabId: page.tabId, origin })
    .then((result) => note(ctx, t(COMPAT_TEXT[result], { origin })))
    .catch((error: unknown) => note(ctx, errorText(error)));
}

function forget(ctx: PanelController): void {
  const origin = ctx.state.page?.origin;
  if (origin === undefined) return note(ctx, t('forgetNoSite'));
  ctx.deps
    .forgetSite(origin)
    .then(() => {
      // Nothing read from the site stays: the files, the facts and the override go with it.
      ctx.state.site = undefined;
      note(ctx, t('forgotSite', { origin }));
      return refreshPage(ctx);
    })
    .catch((error: unknown) => note(ctx, errorText(error)));
}

/** The endpoint host when the running model is a remote endpoint (the export names it). */
function remoteHost(ctx: PanelController): { remote?: string } {
  if (ctx.state.runtime?.remote !== true) return {};
  return { remote: endpointHost(ctx.state.settings.endpoint.url) };
}

function exportChat(ctx: PanelController): void {
  if (ctx.ui.entries.length === 0) return note(ctx, t('exportEmpty'));
  const markdown = exportMarkdown(ctx.ui.entries, {
    origin: ctx.state.page?.origin ?? '-',
    at: ctx.deps.clock.nowIso(),
    model: ctx.state.runtime?.label ?? '-',
    version: ctx.deps.version,
    ...remoteHost(ctx),
    secrets: [ctx.state.settings.endpoint.apiKey],
  });
  ctx.deps.download('webaiassist-conversation.md', markdown);
}

/** The "Graph: N items" chip opens the explorer in a new tab, for the tab and site on the card. */
function openGraph(ctx: PanelController): void {
  const page = ctx.state.page;
  if (page?.origin === undefined) return note(ctx, t('noTab'));
  ctx.deps.openGraph?.(page.tabId, page.origin);
}

/** "Activity log" in More: works on any page, node or not. */
function openActivity(ctx: PanelController): void {
  const page = ctx.state.page;
  if (page?.origin === undefined) ctx.deps.openActivity?.();
  else ctx.deps.openActivity?.(page.tabId, page.origin);
}

function bindHelp(ctx: PanelController): void {
  const doc = ctx.deps.doc;
  const toggle = byId(doc, 'help-toggle');
  const help = byId(doc, 'help');
  const setOpen = (open: boolean): void => {
    help.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) showWelcome(ctx);
    else hideWelcomeAfterHelp(ctx);
  };
  toggle.addEventListener('click', () => setOpen(help.hidden));
  byId(doc, 'help-close').addEventListener('click', () => {
    setOpen(false);
    toggle.focus();
  });
}

export function bindActions(ctx: PanelController): void {
  const doc = ctx.deps.doc;
  byId(doc, 'allow-site').addEventListener('click', () => allow(ctx));
  byId(doc, 'read-page').addEventListener('click', () => void readPage(ctx));
  byId(doc, 'use-anyway').addEventListener('click', () => overrideAiPolicy(ctx));
  bindToolsToggle(doc);
  byId(doc, 'compat').addEventListener('click', () => compat(ctx));
  byId(doc, 'forget').addEventListener('click', () => forget(ctx));
  byId(doc, 'export').addEventListener('click', () => exportChat(ctx));
  byId(doc, 'open-activity').addEventListener('click', () => openActivity(ctx));
  byId(doc, 'open-options').addEventListener('click', () => ctx.deps.openOptions());
  // The chip is drawn in code, after the files are read: one listener on the row serves it.
  byId(doc, 'site-chips').addEventListener('click', (event) => {
    if ((event.target as Element).closest('#open-graph')) openGraph(ctx);
  });
  bindHelp(ctx);
  bindPanelDiagnostics(ctx);
  bindReport(ctx);
}
