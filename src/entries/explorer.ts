// SPDX-License-Identifier: Apache-2.0
// Explorer page entry (explorer.html). The page was opened by the side panel's Graph button with the
// tab to read through and the origin of that tab in its address. This script runs before the site's
// explorer code starts (a module runs after the deferred classic scripts and before
// DOMContentLoaded, where the explorer begins), and does four things:
// 1. replaces window.fetch with the guarded fetch (src/adapters/graph-fetch-shim.ts), so the
//    explorer can read only the node's fixed files through the tab and the peers the user ticked;
// 2. makes a click on a link open a new tab with no opener;
// 3. writes the heading and the note around the explorer, as text;
// 4. starts the tab list (src/ui/explorer/shell.ts), which mounts the Graph tab's peers block and the
//    Query, Vocabulary and Page data tabs (their query workers start when they are first used).
import { createGuardedFetch } from '../adapters/graph-fetch-shim';
import { createTabReader } from '../adapters/explorer-tab-reader';
import { loadNodeFile } from '../adapters/graph-load';
import { createQuerySession } from '../adapters/query-session';
import { readPageData } from '../adapters/site-files';
import { sha256Base64 } from '../adapters/sha256';
import { MessagingToolBridge } from '../adapters/messaging-tool-bridge';
import {
  explorerQuery,
  parseExplorerQuery,
  wantsActivity,
  type ExplorerTarget,
} from '../ui/explorer-url';
import { visible } from '../core/tool-card';
import { byId } from '../ui/dom';
import { applyI18n, t } from '../ui/i18n';
import { bindLinkOpener, openInNewTab } from '../ui/explorer/link-opener';
import { SessionSiteGrants } from '../adapters/session-site-grants';
import { activityTab, type ActivityDeps } from '../ui/explorer/activity-tab';
import { startShell } from '../ui/explorer/shell';
import { EXPLORER_TABS, type ExplorerContext } from '../ui/explorer/tabs';
import { lazyActivityLog } from './shared/activity-log';
import { explorerDeps } from './shared/explorer-deps';
import { makeQueryWorker } from './shared/query-worker-factory';

/** The page address is rewritten to the three fields it needs; the explorer reads it next. */
function normaliseAddress(target: ExplorerTarget): void {
  history.replaceState(null, '', `${location.pathname}?${explorerQuery(target)}`);
}

function showProblem(text: string): void {
  const line = byId(document, 'graph-problem');
  line.textContent = text;
  line.hidden = false;
}

function download(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** The log, and (for a re-run) the same bridge the side panel uses: any extension page is accepted. */
function activityDeps(target?: ExplorerTarget): ActivityDeps {
  const bridge = new MessagingToolBridge(
    (message) => chrome.runtime.sendMessage(message),
    () => crypto.randomUUID(),
  );
  return {
    log: lazyActivityLog,
    bridge,
    grants: new SessionSiteGrants(chrome.storage.session),
    nowIso: () => new Date().toISOString(),
    download,
    ...(target ? { target } : {}),
  };
}

function install(target: ExplorerTarget, approved: Set<string>): ExplorerContext {
  const readTab = createTabReader(explorerDeps, target);
  window.fetch = createGuardedFetch({
    state: { tabOrigin: target.origin, approved },
    readTab,
    realFetch: window.fetch.bind(window),
    sha256: sha256Base64,
    onProblem: showProblem,
  });
  const load = { readTab, sha256: sha256Base64 };
  const session = (file: 'graph-nq' | 'ontology') =>
    createQuerySession({
      loadBytes: () => loadNodeFile(load, target.origin, file),
      makeWorker: makeQueryWorker,
      ...(file === 'ontology' ? { format: 'text/turtle' as const } : {}),
    });
  const query = {
    graph: session('graph-nq'),
    vocabulary: session('ontology'),
    pageData: () => readPageData(explorerDeps, target),
  };
  return { doc: document, target, readTab, approved, query, activity: activityDeps(target) };
}

function withoutTarget(): void {
  byId(document, 'explorer-heading').textContent = t('explorerPageTitle');
  const note = byId(document, 'graph-note');
  note.textContent = t('explorerNeedsLink');
  note.hidden = false;
  byId(document, 'explorer-body').hidden = true;
}

/** The Activity log needs no node: this is the only tab then, and the Graph panel stays hidden. */
function activityOnly(): void {
  // The view's own heading says "Activity log"; the page heading names the extension, and the
  // sentence about a node's files (the graph page's) does not belong here.
  document.title = `${t('activityHeading')} - ${t('appName')}`;
  byId(document, 'explorer-heading').textContent = t('appName');
  document.querySelector('header.page .note')?.remove();
  const note = byId(document, 'graph-note');
  note.textContent = t('activityNoNode');
  note.hidden = false;
  byId(document, 'panel-graph').remove();
  bindLinkOpener(document, openInNewTab);
  const ctx = { doc: document, activity: activityDeps(parseExplorerQuery(location.search)) };
  startShell(
    ctx,
    [activityTab],
    byId(document, 'explorer-tabs'),
    byId(document, 'explorer-panels'),
  );
}

function main(): void {
  applyI18n(document);
  document.title = t('explorerPageTitle');
  if (wantsActivity(location.search)) return activityOnly();
  const target = parseExplorerQuery(location.search);
  if (!target) return withoutTarget();
  normaliseAddress(target);
  const ctx = install(target, new Set<string>());
  bindLinkOpener(document, openInNewTab);
  const host = new URL(target.origin).host;
  byId(document, 'explorer-heading').textContent = t('explorerHeading', {
    host: visible(host).slice(0, 120),
  });
  startShell(
    ctx,
    EXPLORER_TABS,
    byId(document, 'explorer-tabs'),
    byId(document, 'explorer-panels'),
  );
}

main();
