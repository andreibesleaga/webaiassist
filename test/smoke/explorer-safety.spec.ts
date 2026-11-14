// SPDX-License-Identifier: Apache-2.0
// The graph explorer tab against hostile, huge and wrongly digested files, a tab that left the site,
// an address typed into the page, and peers (which need a tick and a click). Stub node and peer:
// explorer-helpers.ts.
import { expect, test } from '@playwright/test';
import {
  base64,
  explorerState as state,
  fixture,
  openExplorer as openExplorerFrom,
  openNodePage as openNodeFrom,
  PEER,
  routePeer,
  serveNode as serveNodeFor,
  type NodeFiles,
} from './explorer-helpers';
import { startSession, type Session } from './harness';

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
});
test.afterEach(async () => {
  await session.close();
});

const serveNode = (origin: string, files?: NodeFiles): void => serveNodeFor(session, origin, files);
const openNodePage = (origin: string) => openNodeFrom(session, origin);
const openExplorer = (tabId: number) => openExplorerFrom(session, tabId);

test('a hostile graph is shown as text: no markup, no script, no javascript: link', async () => {
  const hostile = JSON.parse(fixture('asc-graph.jsonld')) as {
    '@graph': Record<string, unknown>[];
  };
  hostile['@graph'].push({
    '@id': `${session.origin}/concepts/evil/`,
    '@type': 'Concept',
    prefLabel: '<img src=x onerror="window.pwned=1">EVIL',
    definition: '<script>window.pwned=2</script> a definition',
    'schema:url': 'javascript:window.pwned=3',
    inScheme: `${session.origin}/`,
  });
  serveNode(session.origin, { graph: JSON.stringify(hostile) });
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  let dialogs = 0;
  explorer.on('dialog', (dialog) => {
    dialogs += 1;
    void dialog.dismiss();
  });
  await state(explorer, 'ready');
  const evil = explorer.locator('.gx-list button.gx-nb', { hasText: 'EVIL' });
  await expect(evil).toHaveCount(1);
  await expect(evil).toContainText('<img src=x onerror="window.pwned=1">EVIL');
  await evil.click();
  await expect(explorer.locator('.gx-detail')).toContainText('<script>window.pwned=2</script>');
  expect(await explorer.locator('.gx img, .gx script').count()).toBe(0);
  expect(await explorer.locator('.gx a[href^="javascript:"]').count()).toBe(0);
  expect(await explorer.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBe(
    undefined,
  );
  expect(dialogs).toBe(0);
});

test('a graph over the size cap is refused with a plain message and not drawn', async () => {
  const filler = 'x'.repeat(2 * 1024 * 1024 + 1024);
  serveNode(session.origin, { graph: JSON.stringify({ '@graph': [], filler }) });
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  await state(explorer, 'error');
  await expect(explorer.locator('.gx-status')).toContainText('larger than WebAIAssist reads');
  await expect(explorer.locator('.gx-view canvas')).toHaveCount(0);
});

test('a graph with 6,000 nodes is cut by the site’s own limit and says so', async () => {
  const graph = {
    '@graph': Array.from({ length: 6000 }, (_, index) => ({
      '@id': `${session.origin}/concepts/${index}/`,
      '@type': index === 0 ? 'Bundle' : 'Concept',
      prefLabel: `n${index}`,
      ...(index === 0 ? {} : { inScheme: `${session.origin}/concepts/0/` }),
    })),
  };
  serveNode(session.origin, { graph: JSON.stringify(graph) });
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  // The layout of 5,000 nodes takes a while; the cut is in the status line as soon as it is drawn.
  await expect(explorer.locator('.gx-status')).toContainText('the first 5000 drawn', {
    timeout: 60_000,
  });
});

test('a graph that does not match the digest in the linkset is refused and not drawn', async () => {
  serveNode(session.origin, { declared: base64('some other bytes') });
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  await state(explorer, 'error');
  await expect(explorer.locator('#graph-problem')).toBeVisible();
  await expect(explorer.locator('#graph-problem')).toContainText(
    'does not match the SHA-256 digest',
  );
  await expect(explorer.locator('.gx-view canvas')).toHaveCount(0);
  await expect(explorer.locator('.gx-list button.gx-nb')).toHaveCount(0);
});

test('the explorer cannot ask for another path, and a tab that left the site is not read again', async () => {
  serveNode(session.origin);
  const { page, tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  await state(explorer, 'ready');
  const origin = session.origin;
  const refused = await explorer.evaluate(async (target) => {
    try {
      await fetch(`${target}/.well-known/security.txt`);
      return 'allowed';
    } catch (error) {
      return (error as Error).message;
    }
  }, origin);
  expect(refused).toMatch(/fixed list/);
  await page.goto(`${session.otherOrigin}/plain`);
  const count = (): number =>
    session.site.hits.filter((hit) => hit.path === '/chunks.jsonl').length;
  const chunksBefore = count();
  const left = await explorer.evaluate(async (target) => {
    try {
      await fetch(`${target}/chunks.jsonl`);
      return 'allowed';
    } catch (error) {
      return (error as Error).message;
    }
  }, origin);
  expect(left).toBe('The tab left this site, so WebAIAssist stopped reading.');
  expect(count()).toBe(chunksBefore);
});

test('opened without a link from the panel, the page says what to do and reads nothing', async () => {
  const page = await session.context.newPage();
  await page.goto(`chrome-extension://${session.extensionId}/explorer.html`);
  await expect(page.locator('#graph-note')).toContainText('opens from the Graph button');
  await expect(page.locator('#explorer-body')).toBeHidden();
  const hits = session.site.hits.length;
  await page.goto(
    `chrome-extension://${session.extensionId}/explorer.html?tabid=1&origin=javascript:x`,
  );
  await expect(page.locator('#graph-note')).toContainText('opens from the Graph button');
  expect(session.site.hits.length).toBe(hits);
});

test('peers: listed first, nothing read until ticked and pressed, then only the fixed paths', async () => {
  serveNode(session.origin, {
    peers: [
      `${PEER}/.well-known/knowledge-linkset`,
      'http://127.0.0.2/.well-known/knowledge-linkset',
      'https://1.2.3.4/.well-known/knowledge-linkset',
    ],
  });
  const peerLog: string[] = [];
  await routePeer(session.context, peerLog, 'serve');
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  const external: string[] = [];
  explorer.on('request', (request) => {
    if (
      !request.url().startsWith('chrome-extension://') &&
      !request.url().startsWith(session.origin)
    ) {
      external.push(request.url());
    }
  });
  await state(explorer, 'ready');
  const boxes = explorer.locator('.peers input[type="checkbox"]');
  await expect(boxes).toHaveCount(3);
  await expect(boxes.nth(0)).toBeEnabled();
  await expect(boxes.nth(1)).toBeDisabled();
  await expect(boxes.nth(2)).toBeDisabled();
  await expect(explorer.locator('.peers')).toContainText('That node sees your IP address');
  expect(peerLog).toEqual([]);
  expect(external).toEqual([]);
  await expect(explorer.locator('.peers button')).toBeDisabled();
  await boxes.nth(0).check();
  expect(peerLog).toEqual([]);
  await explorer.locator('.peers button').click();
  await expect.poll(() => peerLog.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await state(explorer, 'ready');
  expect(new Set(peerLog)).toEqual(new Set(['/.well-known/knowledge-linkset', '/graph.jsonld']));
  expect(external.every((url) => url.startsWith(`${PEER}/`))).toBe(true);
  // The node itself and the three peers its link set names: the ticked one is read, the other two
  // are refused by the guard and say why.
  await expect(explorer.locator('.gx-sources-list li')).toHaveCount(4);
  await expect(explorer.locator('.gx-sources-list')).toContainText('only over https');
});

test('peers: a node that cannot be reached (no CORS header, offline) is “blocked or unreachable”, the node itself still shows', async () => {
  serveNode(session.origin, { peers: [`${PEER}/.well-known/knowledge-linkset`] });
  await routePeer(session.context, [], 'block');
  const { tabId } = await openNodePage(session.origin);
  const explorer = await openExplorer(tabId);
  await state(explorer, 'ready');
  await explorer.locator('.peers input[type="checkbox"]').check();
  await explorer.locator('.peers button').click();
  await expect(explorer.locator('.gx-sources-list')).toContainText('blocked or unreachable', {
    timeout: 15_000,
  });
  expect(await explorer.locator('.gx-list button.gx-nb').count()).toBeGreaterThan(10);
});
