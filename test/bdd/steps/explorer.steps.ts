// SPDX-License-Identifier: Apache-2.0
// Steps of features/21-graph-explorer.feature: a stub node and peer (test/smoke/explorer-helpers.ts),
// the Graph chip in the panel, and what the explorer tab shows.
import { expect, type Page } from '@playwright/test';
import { axe } from '../../smoke/a11y-helpers';
import {
  explorerState,
  fixture,
  openNodePage,
  PEER,
  routePeer,
  serveNode,
  type NodeFiles,
} from '../../smoke/explorer-helpers';
import { clickToolbarButton, openPanelFor } from '../../smoke/harness';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';

/** The explorer tab each scenario opened, and the requests the stub peer saw. */
const explorers = new WeakMap<World, Page>();
const peerLog = new WeakMap<World, string[]>();
const dialogs = new WeakMap<World, number>();
const leftText = new WeakMap<World, string>();

function explorerOf(world: World): Page {
  const page = explorers.get(world);
  if (!page) throw new Error('open the explorer first');
  return page;
}

async function openNode(world: World, files?: NodeFiles): Promise<void> {
  const session = await world.session();
  serveNode(session, session.origin, files);
  const { page, tabId } = await openNodePage(session, session.origin);
  world.page = page;
  world.tabId = tabId;
}

/** Presses the Graph chip in the world's panel and keeps the tab it opens. */
async function pressChip(world: World): Promise<Page> {
  const session = await world.session();
  const panel = world.requirePanel();
  await expect(panel.locator('#open-graph')).toBeVisible();
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-graph');
  const explorer = await opened;
  await explorer.waitForLoadState('domcontentloaded');
  explorers.set(world, explorer);
  return explorer;
}

async function openExplorerFor(world: World): Promise<Page> {
  if (world.tabId === undefined) throw new Error('open a page first');
  world.panel = await openPanelFor(await world.session(), world.tabId);
  return pressChip(world);
}

Given(
  'a node page that publishes a linkset with counts, a graph and its chunks',
  async ({ world }) => {
    await openNode(world);
  },
);

When('I press the Graph chip', async ({ world }) => {
  await pressChip(world);
});

Then(
  'a tab of the extension opens with the graph of that node drawn, with its nodes listed as buttons',
  async ({ world }) => {
    const explorer = explorerOf(world);
    const session = await world.session();
    expect(
      explorer.url().startsWith(`chrome-extension://${session.extensionId}/explorer.html`),
    ).toBe(true);
    await explorerState(explorer, 'ready');
    await expect(explorer.locator('.gx-view canvas')).toHaveCount(1);
    expect(await explorer.locator('.gx-list button.gx-nb').count()).toBeGreaterThan(10);
  },
);

Given(
  'a node page at a site that WebAIAssist may script only after the toolbar click',
  async ({ world }) => {
    const session = await world.session();
    world.notAllowedYet = true;
    serveNode(session, session.localOrigin);
    const { page, tabId } = await openNodePage(session, session.localOrigin);
    world.page = page;
    world.tabId = tabId;
  },
);

Given('I click the toolbar button on it', async ({ world }) => {
  if (!world.page) throw new Error('open a page first');
  await clickToolbarButton(await world.session(), world.page);
});

When('I press the Graph chip in the side panel', async ({ world }) => {
  await openExplorerFor(world);
});

Then("the explorer tab draws the node's graph", async ({ world }) => {
  const explorer = explorerOf(world);
  await explorerState(explorer, 'ready');
  expect(await explorer.locator('.gx-list button.gx-nb').count()).toBeGreaterThan(10);
});

Given('a node whose linkset declares another digest for its graph', async ({ world }) => {
  const session = await world.session();
  serveNode(session, session.origin, { declared: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
});

Given('a node whose graph is larger than 2 MiB', async ({ world }) => {
  const session = await world.session();
  const filler = 'x'.repeat(2 * 1024 * 1024 + 1024);
  serveNode(session, session.origin, { graph: JSON.stringify({ '@graph': [], filler }) });
});

Given(
  'a node whose graph has a label with an img tag, a script text and a javascript address',
  async ({ world }) => {
    const session = await world.session();
    const graph = JSON.parse(fixture('asc-graph.jsonld')) as {
      '@graph': Record<string, unknown>[];
    };
    graph['@graph'].push({
      '@id': `${session.origin}/concepts/evil/`,
      '@type': 'Concept',
      prefLabel: '<img src=x onerror="window.pwned=1">EVIL',
      definition: '<script>window.pwned=2</script> a definition',
      'schema:url': 'javascript:window.pwned=3',
      inScheme: `${session.origin}/`,
    });
    serveNode(session, session.origin, { graph: JSON.stringify(graph) });
  },
);

When('I open the explorer', async ({ world }) => {
  const session = await world.session();
  const { page, tabId } = await openNodePage(session, session.origin);
  world.page = page;
  world.tabId = tabId;
  await openExplorerFor(world);
});

Then(
  'the explorer says the graph does not match the digest and draws nothing',
  async ({ world }) => {
    const explorer = explorerOf(world);
    await explorerState(explorer, 'error');
    await expect(explorer.locator('#graph-problem')).toContainText(
      'does not match the SHA-256 digest',
    );
    await expect(explorer.locator('.gx-view canvas')).toHaveCount(0);
  },
);

Then(
  'the explorer says the file is larger than WebAIAssist reads and draws nothing',
  async ({ world }) => {
    const explorer = explorerOf(world);
    await explorerState(explorer, 'error');
    await expect(explorer.locator('.gx-status')).toContainText('larger than WebAIAssist reads');
    await expect(explorer.locator('.gx-view canvas')).toHaveCount(0);
  },
);

When('I open the explorer and select that node', async ({ world }) => {
  const session = await world.session();
  const { page, tabId } = await openNodePage(session, session.origin);
  world.page = page;
  world.tabId = tabId;
  const explorer = await openExplorerFor(world);
  dialogs.set(world, 0);
  explorer.on('dialog', (dialog) => {
    dialogs.set(world, (dialogs.get(world) ?? 0) + 1);
    void dialog.dismiss();
  });
  await explorerState(explorer, 'ready');
  await explorer.locator('.gx-list button.gx-nb', { hasText: 'EVIL' }).click();
});

Then(
  'the texts appear as text, no image or script exists and no dialog opens',
  async ({ world }) => {
    const explorer = explorerOf(world);
    await expect(explorer.locator('.gx-detail')).toContainText('<script>window.pwned=2</script>');
    await expect(explorer.locator('.gx-list')).toContainText(
      '<img src=x onerror="window.pwned=1">EVIL',
    );
    expect(await explorer.locator('.gx img, .gx script').count()).toBe(0);
    expect(await explorer.locator('.gx a[href^="javascript:"]').count()).toBe(0);
    expect(await explorer.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBe(
      undefined,
    );
  },
);

async function nodeWithPeers(world: World): Promise<void> {
  const session = await world.session();
  const log: string[] = [];
  peerLog.set(world, log);
  await routePeer(session.context, log, 'serve');
  serveNode(session, session.origin, {
    peers: [
      `${PEER}/.well-known/knowledge-linkset`,
      'http://127.0.0.2/.well-known/knowledge-linkset',
      'https://1.2.3.4/.well-known/knowledge-linkset',
    ],
  });
}

Given(
  'a node that names a public peer, a plain http peer and an IP address as peers',
  async ({ world }) => {
    await nodeWithPeers(world);
  },
);

Then(
  'the three peers are listed, only the public one can be ticked, and nothing was requested from it',
  async ({ world }) => {
    const explorer = explorerOf(world);
    await explorerState(explorer, 'ready');
    const boxes = explorer.locator('.peers input[type="checkbox"]');
    await expect(boxes).toHaveCount(3);
    await expect(boxes.nth(0)).toBeEnabled();
    await expect(boxes.nth(1)).toBeDisabled();
    await expect(boxes.nth(2)).toBeDisabled();
    expect(peerLog.get(world)).toEqual([]);
  },
);

Then(
  'after I tick it and press "Read the ticked nodes" only its fixed files are requested',
  async ({ world }) => {
    const explorer = explorerOf(world);
    await explorer.locator('.peers input[type="checkbox"]').first().check();
    await explorer.getByRole('button', { name: 'Read the ticked nodes' }).click();
    const log = peerLog.get(world) ?? [];
    await expect.poll(() => log.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    expect(new Set(log)).toEqual(new Set(['/.well-known/knowledge-linkset', '/graph.jsonld']));
  },
);

Given('the explorer is open for a node page', async ({ world }) => {
  await openNode(world);
  await openExplorerFor(world);
  await explorerState(explorerOf(world), 'ready');
});

When("the page's tab moves to another site and the explorer asks for a file", async ({ world }) => {
  const session = await world.session();
  if (!world.page) throw new Error('open a page first');
  await world.page.goto(`${session.otherOrigin}/plain`);
  world.hitsBefore = session.site.hits.filter((hit) => hit.path === '/chunks.jsonl').length;
  const origin = session.origin;
  const message = await explorerOf(world).evaluate(async (target) => {
    try {
      await fetch(`${target}/chunks.jsonl`);
      return 'allowed';
    } catch (error) {
      return (error as Error).message;
    }
  }, origin);
  leftText.set(world, message);
});

Then(
  'the explorer says the tab left the site and no request reaches that site',
  async ({ world }) => {
    const session = await world.session();
    expect(leftText.get(world)).toBe('The tab left this site, so WebAIAssist stopped reading.');
    const now = session.site.hits.filter((hit) => hit.path === '/chunks.jsonl').length;
    expect(now).toBe(world.hitsBefore);
  },
);

Given('the explorer is open with peers listed', async ({ world }) => {
  await nodeWithPeers(world);
  const session = await world.session();
  const { page, tabId } = await openNodePage(session, session.origin);
  world.page = page;
  world.tabId = tabId;
  const explorer = await openExplorerFor(world);
  await explorerState(explorer, 'ready');
  await expect(explorer.locator('.peers')).toBeVisible();
});

Then('axe finds no WCAG 2.2 A or AA violation in either theme', async ({ world }) => {
  const explorer = explorerOf(world);
  for (const scheme of ['light', 'dark'] as const) {
    await explorer.emulateMedia({ colorScheme: scheme });
    expect(await axe(explorer), scheme).toEqual([]);
  }
});
