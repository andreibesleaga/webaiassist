// SPDX-License-Identifier: Apache-2.0
// Follows the page in front: reads the tools of the open tab, then (only for a site the panel
// may read) its title and what the site publishes, and draws the card. Every refresh takes a
// number; an answer that comes back after a newer refresh began is dropped, so the card never
// shows an older page over a newer one. When the site changes, a running answer is stopped,
// and the chat of the new site is shown (the conversation stays per site).
import { PageError, type PageInfo } from '../adapters/messaging-tool-bridge';
import { buildSiteFacts, isNodeSite, type Outcomes, type SiteFacts } from '../core/site-facts';
import { toolRows } from '../core/tool-card';
import { forModel, offeredTools } from '../core/tool-offer';
import { byId } from './dom';
import { t } from './i18n';
import { renderAccess, renderCard, type CardView } from './page-card';
import { allowLabel, errorStatus, statusOf, statusText, type PageStatus } from './page-status';
import type { PanelController, SiteState } from './panel-controller';
import { dropStalePageText, note } from './panel-note';
import { relistIfEmpty } from './panel-relist';
import { showSiteChat, stopForSwitch } from './panel-switch';
import { drawNodeCard } from './panel-node-card';
import { runByHand } from './panel-manual-run';
import { starterPrompts } from './starter-prompts';

const hostOf = (origin: string): string => {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
};

/** The user's "Use on this tab anyway" counts only while the model runs on this computer:
 *  an endpoint is a third party and has no override (rule S6). */
function overrideHolds(ctx: PanelController): boolean {
  return ctx.state.site?.override === true && ctx.state.runtime?.remote !== true;
}

/** Does the site ask that its content is not used as AI input, and the user has not said otherwise? */
export function aiBlocked(ctx: PanelController): boolean {
  return ctx.state.site?.facts?.aiInput === 'blocked' && !overrideHolds(ctx);
}

function showStatus(ctx: PanelController, status: PageStatus): void {
  const doc = ctx.deps.doc;
  if (ctx.state.status !== undefined && ctx.state.status.kind !== status.kind) note(ctx, '');
  ctx.state.status = status;
  byId(doc, 'page-status').textContent = statusText(status);
  renderAccess(doc, status);
  const allow = byId<HTMLButtonElement>(doc, 'allow-site');
  const label = allowLabel(status);
  allow.hidden = label === undefined;
  if (label !== undefined) allow.textContent = label;
}

function isNode(ctx: PanelController): boolean {
  const info = ctx.state.page?.info;
  if (!info) return false;
  return isNodeSite(
    info.tools.map((tool) => tool.name),
    info.linkset,
    ctx.state.site?.facts,
  );
}

/** The user overrode a "no AI input" signal. */
function overridden(ctx: PanelController): boolean {
  return overrideHolds(ctx) && ctx.state.site?.facts?.aiInput === 'blocked';
}

function cardView(ctx: PanelController, looking: boolean): CardView {
  const { page, site } = ctx.state;
  const known = {
    ...(page?.title === undefined ? {} : { title: page.title }),
    ...(site?.facts ? { facts: site.facts } : {}),
  };
  return {
    ...known,
    tools: page?.info ? toolRows(page.info.tools) : [],
    looking,
    node: isNode(ctx),
    blocked: aiBlocked(ctx),
    overridden: overridden(ctx),
    canOverride: ctx.state.runtime?.remote !== true,
    run: (tool, text, say) => runByHand(ctx, tool, text, say),
  };
}

/** The site's files are still being read: the card says so until the facts are known. */
const stillLooking = (ctx: PanelController): boolean =>
  ctx.deps.site !== undefined &&
  ctx.state.page?.info !== undefined &&
  ctx.state.site?.facts === undefined;

/** Redraws the status line and the card from the panel's state. */
export function drawPage(ctx: PanelController, looking = stillLooking(ctx)): void {
  const info = ctx.state.page?.info;
  const blocked = aiBlocked(ctx);
  if (info) showStatus(ctx, statusOf(info, { node: isNode(ctx), blocked }));
  renderCard(ctx.deps.doc, cardView(ctx, looking));
  drawNodeCard(ctx, isNode(ctx), blocked);
  ctx.ui.setEmptyText(emptyText(ctx, blocked));
  ctx.ui.setStarters(
    isNode(ctx) && !blocked ? starterPrompts(forModel(ctx.state.page?.info?.tools ?? [])) : [],
  );
}

function emptyText(ctx: PanelController, blocked: boolean): string {
  if (ctx.state.page === undefined) return t('chatEmptyNoPage');
  if (blocked) return t('chatEmptyBlocked');
  return ctx.state.settings.memory ? t('chatEmpty') : t('chatMemoryOff');
}

/** What the browser gave for a tab the panel may not read. */
const NO_TAB: { readonly title?: string; readonly url?: string } = {};

const NO_FILES: Outcomes = {};

const stale = (ctx: PanelController, seq: number): boolean => ctx.state.refreshSeq !== seq;

/** The site changed: the old reading and the user's override go, a running answer stops, and
 *  the chat of the new site (saved, or empty) is shown. */
async function enterSite(
  ctx: PanelController,
  origin: string | undefined,
  seq: number,
): Promise<void> {
  const state = ctx.state;
  state.site = undefined;
  const stopped = stopForSwitch(ctx, origin);
  await showSiteChat(ctx, origin);
  if (!stale(ctx, seq)) stopped?.();
}

async function commit(
  ctx: PanelController,
  tabId: number,
  origin: string | undefined,
  seq: number,
) {
  const previous = ctx.state.page;
  const moved = previous === undefined || previous.origin !== origin || previous.tabId !== tabId;
  const sameSite = previous?.origin === origin && origin !== undefined;
  ctx.state.page = { tabId, ...(origin === undefined ? {} : { origin }) };
  if (moved && !sameSite) await enterSite(ctx, origin, seq);
}

function clearPage(ctx: PanelController): void {
  ctx.state.page = undefined;
  ctx.state.site = undefined;
  showStatus(ctx, { kind: 'none' });
  renderCard(ctx.deps.doc, {
    tools: [],
    looking: false,
    node: false,
    blocked: false,
    overridden: false,
    canOverride: true,
  });
  ctx.ui.setEmptyText(t('chatEmptyNoPage'));
  ctx.ui.setStarters([]);
}

async function listTools(
  ctx: PanelController,
  tabId: number,
): Promise<PageInfo | PageError | Error> {
  try {
    const info = await ctx.deps.bridge.page(tabId);
    // The card shows what the model is offered (a tool whose text carries a turn marker is neither),
    // plus the tools for developers, each with the review written on it (tool-offer.ts).
    const options = { ledger: ctx.state.ledger, manual: true };
    return { ...info, tools: offeredTools(info.tools, info.origin, options) };
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** "Looking at <host>…" while the same tab is listed again. */
function showLooking(ctx: PanelController, tabId: number): void {
  const known = ctx.state.page?.tabId === tabId ? ctx.state.page.origin : undefined;
  if (known === undefined) return;
  byId(ctx.deps.doc, 'page-status').textContent = t('pageLooking', { host: hostOf(known) });
}

/** Reads the tools of the open page (adding the page scripts when needed), then what the site publishes. */
export async function refreshPage(
  ctx: PanelController,
  knownTab?: number,
  attempt = 0,
): Promise<void> {
  const seq = ++ctx.state.refreshSeq;
  const tabId = knownTab ?? (await ctx.deps.targetTab());
  if (stale(ctx, seq)) return;
  if (tabId === undefined) return clearPage(ctx);
  showLooking(ctx, tabId);
  const result = await listTools(ctx, tabId);
  if (stale(ctx, seq)) return;
  if (!('tools' in result)) return failed(ctx, tabId, result, seq);
  await commit(ctx, tabId, result.origin, seq);
  if (stale(ctx, seq)) return;
  ctx.state.page = { tabId, origin: result.origin, info: result };
  drawPage(ctx, ctx.deps.site !== undefined);
  dropStalePageText(ctx);
  // The site's files can take up to ten seconds: the panel does not wait here. A question waits
  // for them (panel-run.ts), so nothing is sent before the site's AI policy is known.
  ctx.state.siteLoading = loadSite(ctx, seq, tabId, result).catch(() => undefined);
  const empty = result.tools.length === 0;
  relistIfEmpty(
    empty,
    attempt,
    () => !stale(ctx, seq),
    (next) => refreshPage(ctx, tabId, next),
  );
}

/** A listing that failed: the page is left as it was unless the error says the site is another one
 *  or cannot be read (a timeout on the same page must not stop an answer or clear the chat). */
async function failed(ctx: PanelController, tabId: number, error: Error, seq: number) {
  const origin = error instanceof PageError ? error.origin : undefined;
  const access = error instanceof PageError ? error.access : undefined;
  if (origin !== undefined || access !== undefined) {
    await commit(ctx, tabId, origin, seq);
    if (stale(ctx, seq)) return;
  }
  showStatus(ctx, errorStatus(error));
  renderCard(ctx.deps.doc, {
    tools: [],
    looking: false,
    node: false,
    blocked: false,
    overridden: false,
    canOverride: true,
  });
  dropStalePageText(ctx);
}

function pathOf(url: string | undefined): string {
  const match = /^https?:\/\/[^/]+(\/[^?#]*)?/.exec(url ?? '');
  return match?.[1] ?? '/';
}

function siteFor(ctx: PanelController, tabId: number, origin: string): SiteState {
  const site = ctx.state.site;
  if (site?.tabId === tabId && site.origin === origin) return site;
  const files = ctx.deps.site?.files({ tabId, origin }) ?? Promise.resolve({});
  const fresh: SiteState = { tabId, origin, files, override: false };
  ctx.state.site = fresh;
  return fresh;
}

async function loadSite(ctx: PanelController, seq: number, tabId: number, info: PageInfo) {
  const deps = ctx.deps.site;
  if (!deps) return;
  const target = { tabId, origin: info.origin };
  const tab = await deps.tab(tabId).catch(() => NO_TAB);
  if (stale(ctx, seq)) return;
  ctx.state.page = { ...ctx.state.page, tabId, origin: info.origin, info, ...tab };
  noteSamePageChange(ctx, tab.title);
  const site = siteFor(ctx, tabId, info.origin);
  drawPage(ctx, site.facts === undefined);
  const [outcomes, page] = await Promise.all([site.files.catch(() => NO_FILES), deps.page(target)]);
  if (stale(ctx, seq)) return;
  const nowMs = Date.parse(ctx.deps.clock.nowIso());
  const facts: SiteFacts = buildSiteFacts({
    origin: info.origin,
    outcomes,
    pagePath: pathOf(tab.url),
    nowMs,
    ...(page ? { page } : {}),
  });
  site.facts = facts;
  drawPage(ctx);
}

/** Another page of the same site while an answer runs: the answer goes on, a note comes at its end. */
function noteSamePageChange(ctx: PanelController, title: string | undefined): void {
  if (ctx.state.running && title !== undefined) ctx.state.pageChangedTo = title;
}

/** Only the title changed: the title row is redrawn, the tools are not listed again. */
export async function refreshTitle(ctx: PanelController): Promise<void> {
  const page = ctx.state.page;
  const deps = ctx.deps.site;
  if (!page?.info || !deps) return;
  const tab = await deps.tab(page.tabId).catch(() => NO_TAB);
  if (ctx.state.page !== page) return;
  ctx.state.page = { ...page, ...tab };
  noteSamePageChange(ctx, tab.title);
  drawPage(ctx);
}

/** The user said "Use on this tab anyway" for a site that asks for no AI input. */
export function overrideAiPolicy(ctx: PanelController): void {
  const site = ctx.state.site;
  if (!site || ctx.state.runtime?.remote === true) return;
  site.override = true;
  drawPage(ctx);
}
