// SPDX-License-Identifier: Apache-2.0
// Steps of features/22-query-tools.feature: a stub node that publishes graph.nq and its vocabulary
// (test/smoke/explorer-helpers.ts), and the Query, Vocabulary and Page data tabs of the explorer page.
import { expect, type Page } from '@playwright/test';
import {
  openExplorer,
  openNodePage,
  serveNode,
  serveQueryFiles,
} from '../../smoke/explorer-helpers';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';

const explorers = new WeakMap<World, Page>();
const outside = new WeakMap<World, string[]>();
const BOX = '#query-editor';

function explorerOf(world: World): Page {
  const page = explorers.get(world);
  if (!page) throw new Error('open the explorer first');
  return page;
}

async function openTab(world: World, tab: string): Promise<Page> {
  const session = await world.session();
  if (world.tabId === undefined) throw new Error('open a node page first');
  const explorer = explorers.get(world) ?? (await openExplorer(session, world.tabId));
  explorers.set(world, explorer);
  await explorer.click(`#tab-${tab}`);
  return explorer;
}

async function run(world: World, text?: string): Promise<Page> {
  const explorer = await openTab(world, 'query');
  if (text !== undefined) await explorer.locator(BOX).fill(text);
  await explorer.click('#query-run');
  return explorer;
}

const status = (world: World) => explorerOf(world).locator('#query-status');

Given('a node page that publishes its graph as N-Quads and its vocabulary', async ({ world }) => {
  const session = await world.session();
  serveNode(session, session.origin);
  serveQueryFiles(session);
  const { page, tabId } = await openNodePage(session, session.origin);
  world.page = page;
  world.tabId = tabId;
});

Given('the page has structured data with a bold tag in a name', async ({ world }) => {
  await world.page?.evaluate(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = '{"@type":"Thing","name":"<b>bold</b>"}';
    document.head.append(script);
  });
});

When('I open the Query tab of the explorer and press Run', async ({ world }) => {
  await run(world);
});

Then(
  'the status says SELECT answered with 17 rows and the table has 17 rows',
  async ({ world }) => {
    await expect(status(world)).toHaveText('SELECT answered with 17 rows.', { timeout: 30_000 });
    await expect(explorerOf(world).locator('.query-result tbody tr')).toHaveCount(17);
  },
);

When('I open the Query tab of the explorer and run an INSERT query', async ({ world }) => {
  await run(world, 'INSERT DATA { <urn:a> <urn:b> <urn:c> }');
});

Then('the status says that an update is refused', async ({ world }) => {
  await expect(status(world)).toContainText('an update is refused', { timeout: 30_000 });
});

Then('asking whether the inserted statement exists answers no', async ({ world }) => {
  const explorer = explorerOf(world);
  await explorer.locator(BOX).fill('ASK { <urn:a> <urn:b> <urn:c> }');
  await explorer.click('#query-run');
  await expect(status(world)).toHaveText('ASK answered no.', { timeout: 30_000 });
});

When(
  'I open the Query tab of the explorer and run a query with four unconnected patterns',
  async ({ world }) => {
    const explorer = await run(
      world,
      'SELECT (COUNT(*) AS ?n) WHERE { ?a ?b ?c . ?d ?e ?f . ?g ?h ?i . ?j ?k ?l }',
    );
    await expect(explorer.locator('#query-stop')).toBeEnabled({ timeout: 30_000 });
    await explorer.waitForTimeout(500);
  },
);

When('I press Stop', async ({ world }) => {
  await explorerOf(world).click('#query-stop');
});

Then('the status says Stopped within one second', async ({ world }) => {
  await expect(status(world)).toHaveText('Stopped.', { timeout: 1000 });
});

Then('the next query is answered', async ({ world }) => {
  const explorer = explorerOf(world);
  await explorer.locator(BOX).fill('ASK { ?s ?p ?o }');
  await explorer.click('#query-run');
  await expect(status(world)).toHaveText('ASK answered yes.', { timeout: 30_000 });
});

When(
  'I open the Query tab of the explorer and run a query with FROM and a remote address',
  async ({ world }) => {
    const session = await world.session();
    const seen: string[] = [];
    outside.set(world, seen);
    session.context.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('chrome-extension://') && !url.startsWith(session.origin)) seen.push(url);
    });
    await run(world, 'SELECT * FROM <https://evil.example/data> WHERE { ?s ?p ?o }');
  },
);

Then('the status says SELECT answered with 0 rows', async ({ world }) => {
  await expect(status(world)).toHaveText('SELECT answered with 0 rows.', { timeout: 30_000 });
});

Then('no request went to any address but the extension and the node', ({ world }) => {
  expect(outside.get(world)).toEqual([]);
});

When(
  'I open the Query tab of the explorer and press Put in editor on the eighth question',
  async ({ world }) => {
    const explorer = await openTab(world, 'query');
    await explorer.locator('.query-examples button').nth(7).click();
  },
);

Then(
  "the box holds that question's query and the status still says to press Run",
  async ({ world }) => {
    await expect(explorerOf(world).locator(BOX)).toHaveValue(/skos:member\+/);
    await expect(status(world)).toHaveText('Press Run to ask.');
  },
);

When('I open the Vocabulary tab and the Page data tab of the explorer', async ({ world }) => {
  await openTab(world, 'page-data');
  await openTab(world, 'vocab');
});

Then(
  'the vocabulary lists the class asc:Concept and the page data shows the tag as text',
  async ({ world }) => {
    const explorer = explorerOf(world);
    await expect(explorer.locator('#panel-vocab tbody').first()).toContainText('asc:Concept', {
      timeout: 30_000,
    });
    await explorer.click('#tab-page-data');
    await expect(explorer.locator('pre.page-data')).toContainText('"name": "<b>bold</b>"');
    await expect(explorer.locator('#panel-page-data b')).toHaveCount(0);
  },
);
