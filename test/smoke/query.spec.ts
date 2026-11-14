// SPDX-License-Identifier: Apache-2.0
// The Query, Vocabulary and Page data tabs of the explorer page, in the smoke build, on a stub node that
// publishes the linkset, graph.nq and the vocabulary file recorded from the live main node. The query
// engine (oxigraph, WebAssembly) runs in the query worker of the extension.
import { expect, test, type Page } from '@playwright/test';
import { axe } from './a11y-helpers';
import { openExplorer, openNodePage, serveNode, serveQueryFiles } from './explorer-helpers';
import { startSession, type Session } from './harness';

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
  serveNode(session, session.origin);
  serveQueryFiles(session);
});
test.afterEach(async () => {
  await session.close();
});

async function queryTab(): Promise<Page> {
  const { tabId } = await openNodePage(session, session.origin);
  const explorer = await openExplorer(session, tabId);
  await explorer.click('#tab-query');
  return explorer;
}

const setQuery = (page: Page, text: string): Promise<void> =>
  page.locator('#query-editor').fill(text);
const status = (page: Page) => page.locator('#query-status');

test('Query runs the first query and shows the node’s items as a table', async () => {
  const explorer = await queryTab();
  await expect(page(explorer)).toBeVisible();
  await explorer.click('#query-run');
  await expect(status(explorer)).toHaveText('SELECT answered with 17 rows.', { timeout: 30_000 });
  await expect(explorer.locator('.query-result tbody tr')).toHaveCount(17);
  await expect(explorer.locator('.query-result caption')).toHaveText('The result: 17 rows.');
});
const page = (explorer: Page) => explorer.locator('#panel-query');

test('an update is refused with the engine’s own sentence, and nothing is changed', async () => {
  const explorer = await queryTab();
  await setQuery(explorer, 'INSERT DATA { <urn:a> <urn:b> <urn:c> }');
  await explorer.click('#query-run');
  await expect(status(explorer)).toContainText('an update is refused', { timeout: 30_000 });
  await expect(explorer.locator('.query-result table')).toHaveCount(0);
  await setQuery(explorer, 'ASK { <urn:a> <urn:b> <urn:c> }');
  await explorer.click('#query-run');
  await expect(status(explorer)).toHaveText('ASK answered no.');
});

test('at most 200 rows are shown, and the caption says how many there were', async () => {
  const explorer = await queryTab();
  await setQuery(explorer, 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }');
  await explorer.click('#query-run');
  await expect(status(explorer)).toHaveText('SELECT answered with 377 rows.', { timeout: 30_000 });
  await expect(explorer.locator('.query-result tbody tr')).toHaveCount(200);
  await expect(explorer.locator('.query-result caption')).toHaveText(
    'The result: 377 rows, the first 200 shown here.',
  );
});

test('Stop ends a query that would run for minutes, within one second', async () => {
  const explorer = await queryTab();
  await setQuery(
    explorer,
    'SELECT (COUNT(*) AS ?n) WHERE { ?a ?b ?c . ?d ?e ?f . ?g ?h ?i . ?j ?k ?l }',
  );
  await explorer.click('#query-run');
  await expect(explorer.locator('#query-stop')).toBeEnabled({ timeout: 30_000 });
  await explorer.waitForTimeout(500);
  const before = Date.now();
  await explorer.click('#query-stop');
  await expect(status(explorer)).toHaveText('Stopped.', { timeout: 1000 });
  expect(Date.now() - before).toBeLessThan(1000);
  await setQuery(explorer, 'ASK { ?s ?p ?o }');
  await explorer.click('#query-run');
  await expect(status(explorer)).toHaveText('ASK answered yes.', { timeout: 30_000 });
});

test('a query that names a remote graph with FROM makes no request and answers nothing', async () => {
  const explorer = await queryTab();
  const outside: string[] = [];
  session.context.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('chrome-extension://') && !url.startsWith(session.origin))
      outside.push(url);
  });
  await setQuery(explorer, 'SELECT * FROM <https://evil.example/data> WHERE { ?s ?p ?o }');
  await explorer.click('#query-run');
  await expect(status(explorer)).toHaveText('SELECT answered with 0 rows.', { timeout: 30_000 });
  expect(outside).toEqual([]);
});

test('"Put in editor" fills the box and does not run', async () => {
  const explorer = await queryTab();
  await explorer.locator('.query-examples button').nth(7).click();
  await expect(explorer.locator('#query-editor')).toHaveValue(/skos:member\+/);
  await expect(status(explorer)).toHaveText('Press Run to ask.');
});

test('the keyboard reaches the box and Run, and the tab is axe-clean in both themes', async () => {
  const explorer = await queryTab();
  await explorer.locator('#query-editor').focus();
  await explorer.keyboard.press('Tab');
  await expect(explorer.locator('#query-run')).toBeFocused();
  await explorer.keyboard.press('Enter');
  await expect(status(explorer)).toHaveText('SELECT answered with 17 rows.', { timeout: 30_000 });
  for (const scheme of ['light', 'dark'] as const) {
    await explorer.emulateMedia({ colorScheme: scheme });
    expect(await axe(explorer), scheme).toEqual([]);
  }
});

test('Vocabulary lists classes and properties of the node, read only when the tab is opened', async () => {
  const { tabId } = await openNodePage(session, session.origin);
  const explorer = await openExplorer(session, tabId);
  const before = session.site.hits.filter((hit) => hit.path === '/ns/agsc.ttl').length;
  expect(before).toBe(0);
  await explorer.click('#tab-vocab');
  await expect(explorer.locator('#panel-vocab caption').first()).toHaveText('Classes', {
    timeout: 30_000,
  });
  await expect(explorer.locator('#panel-vocab tbody').first()).toContainText('asc:Concept');
  await expect(explorer.locator('#panel-vocab li code')).toContainText(['/ns/agsc.ttl']);
  expect(await axe(explorer)).toEqual([]);
});

test('Page data shows the JSON-LD of the open page as text', async () => {
  const { page: open, tabId } = await openNodePage(session, session.origin);
  await open.evaluate(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = '{"@type":"Thing","name":"<b>bold</b>"}';
    document.head.append(script);
  });
  const explorer = await openExplorer(session, tabId);
  await explorer.click('#tab-page-data');
  await expect(explorer.locator('pre.page-data')).toContainText('"name": "<b>bold</b>"');
  await expect(explorer.locator('#panel-page-data b')).toHaveCount(0);
});
