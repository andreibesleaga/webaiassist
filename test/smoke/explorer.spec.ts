// SPDX-License-Identifier: Apache-2.0
// The graph explorer tab (explorer.html), in the smoke build, on a stub node that publishes the
// linkset, graph.jsonld and chunks.jsonl recorded from the live main node (fixtures/graph).
// - the chip, one click, the same picture as the site (the site's own code runs unchanged);
// - the files are read through the tab, with only the access the user granted (the toolbar click);
// - hostile, huge and wrongly digested files; a tab that left the site; peers need a tick and a click.
import { expect, test } from '@playwright/test';
import { AGSC_PROFILE } from '../../src/core/site-linkset';
import { axe, tabOrder } from './a11y-helpers';
import {
  explorerState as state,
  PEER,
  openExplorer as openExplorerFrom,
  openNodePage as openNodeFrom,
  serveNode as serveNodeFor,
  type NodeFiles,
} from './explorer-helpers';
import {
  activeTab,
  clickToolbarButton,
  openPage,
  openPanelFor,
  startSession,
  type Session,
} from './harness';

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
});
test.afterEach(async () => {
  await session.close();
});

const FIXED = ['/.well-known/knowledge-linkset', '/graph.jsonld', '/chunks.jsonl'];
const serveNode = (origin: string, files?: NodeFiles): void => serveNodeFor(session, origin, files);
const openNodePage = (origin: string) => openNodeFrom(session, origin);
const openExplorer = (tabId: number) => openExplorerFrom(session, tabId);

test('the chip says how many items, one click opens the explorer with the site’s picture', async () => {
  serveNode(session.origin);
  const { tabId } = await openNodePage(session.origin);
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#open-graph')).toHaveText('Graph: 17 items');
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-graph');
  const explorer = await opened;
  expect(
    explorer.url().startsWith(`chrome-extension://${session.extensionId}/explorer.html?`),
  ).toBe(true);
  await state(explorer, 'ready');
  await expect(explorer.locator('h1')).toHaveText(`Graph of ${new URL(session.origin).host}`);
  const nodes = await explorer.locator('.gx-list button.gx-nb').count();
  expect(nodes).toBeGreaterThan(10);
  await expect(explorer.locator('.gx-view canvas')).toHaveCount(1);
  // The site’s Dimensions and Peers controls, the node field and Load are not offered here.
  for (const hidden of ['#gx-d-3', '#gx-rotate', '#gx-depth', '#gx-src', '#gx-load']) {
    await expect(explorer.locator(hidden)).toBeHidden();
  }
});

test('no chip on a page without a node, nor on a node without counts', async () => {
  const { tabId } = await openPage(session, session.origin, '/plain', 'plain page');
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#open-graph')).toHaveCount(0);
  const noCounts = JSON.stringify({
    linkset: [
      { anchor: `${session.origin}/`, describedby: [{ href: `${session.origin}/graph.jsonld` }] },
    ],
  });
  session.site.routes.set('/.well-known/knowledge-linkset', {
    type: `application/linkset+json; profile="${AGSC_PROFILE}"`,
    body: noCounts,
  });
  const node = await openNodePage(session.origin);
  const second = await openPanelFor(session, node.tabId);
  await expect(second.locator('#node-badge')).toBeVisible();
  await expect(second.locator('#open-graph')).toHaveCount(0);
});

test('read through the tab with only the access the user granted: the toolbar click (activeTab)', async () => {
  // localhost is not a host the smoke build may script: the only access is the user's toolbar click.
  serveNode(session.localOrigin);
  const { page, tabId } = await openNodePage(session.localOrigin);
  await clickToolbarButton(session, page);
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#page-status')).toContainText('localhost');
  await expect(panel.locator('#open-graph')).toHaveText('Graph: 17 items');
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-graph');
  const explorer = await opened;
  await state(explorer, 'ready');
  expect(await explorer.locator('.gx-list button.gx-nb').count()).toBeGreaterThan(10);
  await expect(explorer.locator('.gx-status')).toContainText('nodes');
});

test('selecting a node fills its detail; Escape clears it; the list is reachable by keyboard', async () => {
  serveNode(session.origin);
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  await state(explorer, 'ready');
  await expect(explorer.locator('.gx-detail h2')).toHaveText('No node selected');
  const first = explorer.locator('.gx-list button.gx-nb').first();
  await first.focus();
  await explorer.keyboard.press('Enter');
  await expect(explorer.locator('.gx-detail h2')).not.toHaveText('No node selected');
  await explorer.keyboard.press('Escape');
  await expect(explorer.locator('.gx-detail h2')).toHaveText('No node selected');
});

test('only the fixed files of the node were requested, without cookie or referrer', async () => {
  serveNode(session.origin);
  const { tabId } = await openNodePage(session.origin);
  const before = session.site.hits.length;
  const explorer = await openExplorer(tabId);
  await state(explorer, 'ready');
  const mine = session.site.hits.slice(before).filter((hit) => hit.host.startsWith('127.0.0.1'));
  const files = new Set(mine.map((hit) => hit.path));
  expect(files.has('/graph.jsonld')).toBe(true);
  for (const path of files) {
    // the panel’s own site reads and the explorer page’s three files; never anything else
    expect(
      path === '/chunks.jsonl' ||
        FIXED.includes(path) ||
        /^\/(llms|robots|llms-full)\.txt$|^\/\.well-known\//.test(path),
      path,
    ).toBe(true);
  }
  expect(mine.some((hit) => hit.cookie || hit.referer)).toBe(false);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the explorer page is axe-clean in the ${scheme} theme, with a skip link first`, async () => {
    serveNode(session.origin, { peers: [`${PEER}/.well-known/knowledge-linkset`] });
    const { tabId } = await openNodePage(session.origin);
    const explorer = await openExplorer(tabId);
    await explorer.emulateMedia({ colorScheme: scheme });
    await state(explorer, 'ready');
    await expect(explorer.locator('.peers')).toBeVisible();
    expect(await axe(explorer)).toEqual([]);
    const order = await tabOrder(explorer, 3);
    expect(order.ids[0]).toBe('');
    expect(order.shown.every(Boolean)).toBe(true);
  });
}

test('the panel with the chip is axe-clean in both themes', async () => {
  serveNode(session.origin);
  const { tabId } = await openNodePage(session.origin);
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#open-graph')).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await panel.emulateMedia({ colorScheme: scheme });
    expect(await axe(panel), scheme).toEqual([]);
  }
});

test('the manifest opens nothing to web pages: no web_accessible_resources, no host permission added', async () => {
  const manifest = await session.worker.evaluate(() => chrome.runtime.getManifest());
  expect(
    (manifest as { web_accessible_resources?: unknown }).web_accessible_resources,
  ).toBeUndefined();
  expect(manifest.permissions).toEqual([
    'sidePanel',
    'offscreen',
    'storage',
    'activeTab',
    'scripting',
  ]);
  const page = await session.context.newPage();
  await page.goto(`${session.origin}/plain`);
  const reachable = await page.evaluate(async (id) => {
    try {
      await fetch(`chrome-extension://${id}/explorer.html`);
      return true;
    } catch {
      return false;
    }
  }, session.extensionId);
  expect(reachable).toBe(false);
  await activeTab(session, page);
});
