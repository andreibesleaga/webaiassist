// SPDX-License-Identifier: Apache-2.0
// The small pictures of the README (docs/images/*.png), taken from the smoke build: the scripted
// test model, a test page that stands for a node (the recorded files of the main node, five of its
// tools), and the review test page. They show the interface, not a real model's answers. They are
// written only when WEBAIASSIST_README_SHOTS=1. Run: npm run shots:readme
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveNode, serveQueryFiles, explorerState } from './explorer-helpers';
import { openPage, openPanelFor, openReviewPage, startSession, type Session } from './harness';

const DIR = join(process.cwd(), 'docs/images');
const shot = (name: string) => join(DIR, `${name}.png`);
const PANEL = { width: 400, height: 860 };
const WIDE = { width: 960, height: 760 };

test.skip(process.env.WEBAIASSIST_README_SHOTS !== '1', 'set WEBAIASSIST_README_SHOTS=1');

/** A page that links the node's link set and registers five tools named as a node names them. */
const NODE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Example node</title>
    <link rel="describedby" href="/.well-known/knowledge-linkset" type="application/linkset+json" />
  </head>
  <body>
    <h1>Example node</h1>
    <p id="status">Registering…</p>
    <script type="module">
      const text = { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] };
      const slug = { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] };
      const reads = { readOnlyHint: true };
      const tools = [
        ['search', 'Find items of this node by words.', text, reads, 'handoff: how work passes between agents, with context.'],
        ['read', 'Read one item of this node by its slug.', slug, reads, 'handoff: how work passes between agents.'],
        ['links', 'List the items an item links to.', slug, reads, 'handoff links to review and to memory.'],
        ['ask', 'Answer a question from the items of this node.', text, reads, 'Agents share work through handoffs.'],
        ['propose', 'Propose a new item for this node.', { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title'] }, {}, 'A proposal was prepared for you to export.'],
      ];
      for (const [name, description, inputSchema, annotations, result] of tools) {
        await document.modelContext.registerTool({ name, description, inputSchema, annotations, execute: () => result });
      }
      document.getElementById('status').textContent = 'example node ready';
    </script>
  </body>
</html>`;

let session: Session;
test.beforeEach(async () => {
  mkdirSync(DIR, { recursive: true });
  session = await startSession();
  serveNode(session, session.origin);
  serveQueryFiles(session);
  session.site.routes.set('/example', { type: 'text/html; charset=utf-8', body: NODE_PAGE });
});
test.afterEach(async () => {
  await session.close();
});

async function ready(panel: Page, size = PANEL): Promise<void> {
  await panel.setViewportSize(size);
  await panel.emulateMedia({ colorScheme: 'light' });
  const welcome = panel.locator('#first-run-ok');
  if (await welcome.isVisible()) await welcome.click();
}

async function nodePanel(): Promise<{ panel: Page; tabId: number }> {
  const { tabId } = await openPage(session, session.origin, '/example', 'example node ready');
  const panel = await openPanelFor(session, tabId);
  await ready(panel);
  await expect(panel.locator('#page-status')).toContainText('5 WebMCP tools');
  return { panel, tabId };
}

/** Scrolls the element to the top of whatever scrolls it, so the picture shows it. */
async function toTop(panel: Page, selector: string): Promise<void> {
  await panel.locator(selector).evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

async function startModel(panel: Page): Promise<void> {
  await panel.selectOption('#model', 'scripted');
  await panel.click('#start');
  await expect(panel.locator('#model-status')).toContainText('Ready');
}

/** Sends a question and answers every question before the one titled `until`, which stays open. */
async function askUntil(panel: Page, text: string, until: string): Promise<void> {
  await panel.fill('#question', text);
  await panel.press('#question', 'Control+Enter');
  const title = panel.locator('#confirm-title');
  await expect(title).toBeVisible();
  for (let i = 0; i < 3 && (await title.textContent()) !== until; i += 1) {
    await panel.click('#confirm-allow');
    await expect(title).toBeVisible();
  }
  await expect(title).toHaveText(until);
}

test('the side panel on a node: its tools, the question before a call, the answer', async () => {
  const { panel } = await nodePanel();
  await startModel(panel);
  await panel.click('#tools-toggle');
  await expect(panel.locator('#tools-rows li')).toHaveCount(5);
  await toTop(panel, '#tools-toggle');
  await panel.screenshot({ path: shot('panel-tools') });

  await panel.click('#tools-toggle');
  await askUntil(
    panel,
    '/tool propose {"title": "Handoff checklist", "body": "What a handoff must carry."}',
    'Run the tool propose?',
  );
  await panel.screenshot({ path: shot('panel-question') });

  await panel.click('#confirm-allow');
  await expect(panel.locator('#transcript li.assistant')).toHaveCount(1);
  // A taller panel: with the page card open the conversation has little room at 860 px.
  await panel.setViewportSize({ width: 400, height: 1180 });
  await panel
    .locator('#transcript li')
    .last()
    .evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await panel.screenshot({ path: shot('panel-answer') });
});

test('the tool review: a tool with a finding is marked "check" with its reason', async () => {
  const { tabId } = await openReviewPage(session);
  const panel = await openPanelFor(session, tabId);
  await ready(panel);
  await panel.click('#tools-toggle');
  await expect(panel.locator('#tools-rows .mark.check').first()).toBeVisible();
  await toTop(panel, '#tools-toggle');
  await panel.screenshot({ path: shot('tool-review') });
});

test('the explorer tab: the graph of the node and a query over it', async () => {
  const { panel } = await nodePanel();
  await expect(panel.locator('#open-graph')).toBeVisible();
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-graph');
  const explorer = await opened;
  await explorer.setViewportSize(WIDE);
  await explorer.emulateMedia({ colorScheme: 'light' });
  await explorerState(explorer, 'ready');
  await expect(explorer.locator('.gx-view canvas')).toHaveCount(1);
  await explorer.waitForTimeout(2_500); // the picture settles
  await explorer.screenshot({ path: shot('explorer-graph') });

  await explorer.click('#tab-query');
  await explorer.click('#query-run');
  await expect(explorer.locator('#query-status')).toContainText('answered with', {
    timeout: 30_000,
  });
  await explorer.screenshot({ path: shot('explorer-query') });
});

test('the activity log: one entry for each question, kept in the browser', async () => {
  const { panel } = await nodePanel();
  await startModel(panel);
  await askUntil(panel, '/tool search {"query": "handoff"}', 'Run the tool search?');
  await panel.click('#confirm-allow');
  await expect(panel.locator('#transcript li.assistant')).toHaveCount(1);
  if ((await panel.locator('#more[open]').count()) === 0) await panel.click('#more-toggle');
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-activity');
  const view = await opened;
  await view.setViewportSize(WIDE);
  await view.emulateMedia({ colorScheme: 'light' });
  await expect(view.getByRole('log', { name: /activity/i })).toContainText('search');
  await view.screenshot({ path: shot('activity-log') });
});
