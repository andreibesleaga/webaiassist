// SPDX-License-Identifier: Apache-2.0
// Steps about the card following the browser (features 04, 07, 09 and 14): several tabs, a page
// that changes, a second site, a running answer and the chat of each site. The panel of these
// scenarios follows the tab the test brings to the front (the development build's ?follow=1).
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';
import { openSite, openSitePanel, openTab, PLAIN, scriptedReady, STUB } from './site-helpers';

const hostOf = (origin: string): string => new URL(origin).host;

Given('a page with two WebMCP tools is open in one tab', async ({ world }) => {
  const origin = (await world.session()).origin;
  const { page, tabId } = await openTab(world, 'first', origin, STUB);
  world.page = page;
  world.tabId = tabId;
});

Given('a page without WebMCP tools is open in another tab', async ({ world }) => {
  const origin = (await world.session()).origin;
  const { page, tabId } = await openTab(world, 'second', origin, PLAIN);
  world.page = page;
  world.tabId = tabId;
});

Given('the side panel follows the tab in front', async ({ world }) => {
  const panel = await openSitePanel(world, true);
  await expect(panel.locator('#page-status')).toContainText('WebMCP tool');
});

When('I switch to the {word} tab', async ({ world }, which: string) => {
  const name = which === 'first' ? 'first' : 'second';
  await world.pages.get(name)?.page.bringToFront();
});

Then("the card shows the first page's site and {string}", async ({ world }, text: string) => {
  const host = hostOf((await world.session()).origin);
  await expect(world.requirePanel().locator('#page-status')).toHaveText(`${host} — ${text}`);
});

Then("the card shows the second page's site and that it has no WebMCP tools", async ({ world }) => {
  const host = hostOf((await world.session()).origin);
  const line = world.requirePanel().locator('#page-status');
  await expect(line).toContainText(host);
  await expect(line).toContainText('no WebMCP tools');
});

Given('the side panel is open on an allowed page', async ({ world }) => {
  await openSite(world, { follow: true });
  await expect(world.requirePanel().locator('#page-status')).toContainText('2 WebMCP tools');
});

Given('the side panel is open on a page with two WebMCP tools', async ({ world }) => {
  await openSite(world, { follow: true });
  await expect(world.requirePanel().locator('#page-status')).toContainText('2 WebMCP tools');
});

When('I switch to a tab on a site that is not allowed yet', async ({ world }) => {
  const session = await world.session();
  await openTab(world, 'local', session.localOrigin, STUB);
  world.hitsBefore = session.site.hits.length;
});

Then(
  'the page line says {string} and the Allow button is shown',
  async ({ world }, text: string) => {
    const panel = world.requirePanel();
    await expect(panel.locator('#page-status')).toHaveText(text);
    await expect(panel.locator('#allow-site')).toBeVisible();
  },
);

Then('nothing was fetched from that site', async ({ world }) => {
  const session = await world.session();
  const host = hostOf(session.localOrigin);
  const since = session.site.hits.slice(world.hitsBefore);
  expect(since.filter((hit) => hit.host === host)).toEqual([]);
});

/** Records every text the page line shows, so a short "Looking at" state is not missed. */
async function watchStatus(panel: Page): Promise<void> {
  await panel.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __statusLines: string[] }).__statusLines = seen;
    const line = document.getElementById('page-status') as HTMLElement;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) seen.push(node.textContent ?? '');
      }
    }).observe(line, { childList: true });
  });
}

const statusLines = (panel: Page): Promise<string[]> =>
  panel.evaluate(() => (window as unknown as { __statusLines: string[] }).__statusLines);

When('the page navigates to another path of the same site', async ({ world }) => {
  await watchStatus(world.requirePanel());
  await world.page?.goto(`${await world.origin()}/plain`);
});

Then(
  "the card shows {string} and then the new page's tools",
  async ({ world }, looking: string) => {
    const panel = world.requirePanel();
    await expect(panel.locator('#page-status')).toContainText('no WebMCP tools');
    expect(await statusLines(panel)).toContain(await world.fill(looking));
  },
);

When('the page changes only its title', async ({ world }) => {
  const panel = world.requirePanel();
  world.hitsBefore = (await statusLines(panel)).filter((line) =>
    line.startsWith('Looking at'),
  ).length;
  await world.page?.evaluate(() => {
    document.title = 'A new title';
  });
});

Then('the title row changes and the tools are not listed again', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#page-title')).toHaveText('A new title');
  const looking = (await statusLines(panel)).filter((line) => line.startsWith('Looking at'));
  expect(looking).toHaveLength(world.hitsBefore);
});

When('the page registers a third tool', async ({ world }) => {
  await world.page?.evaluate(() =>
    (window as unknown as { registerThird(): unknown }).registerThird(),
  );
});

Then('the card shows 3 tools within a moment', async ({ world }) => {
  await expect(world.requirePanel().locator('#page-status')).toContainText('3 WebMCP tools');
});

/** Asks `/tool add` and waits until the question "Run the tool add?" is open: an answer is running. */
async function startRunningAnswer(world: World): Promise<void> {
  const panel = world.requirePanel();
  await scriptedReady(world);
  await panel.fill('#question', '/tool add {"a": 1, "b": 2}');
  await panel.press('#question', 'Control+Enter');
  await expect(panel.locator('#confirm-title')).toContainText('Use the tools');
  await panel.click('#confirm-allow');
  await expect(panel.locator('#confirm-title')).toContainText('Run the tool add');
}

Given('a tool confirmation is open', async ({ world }) => {
  await openSite(world, { follow: true });
  await startRunningAnswer(world);
});

Given('an answer is running', async ({ world }) => {
  await openSite(world, { follow: true });
  await startRunningAnswer(world);
});

When('the tab moves to another site', async ({ world }) => {
  const session = await world.session();
  await openTab(world, 'other', session.otherOrigin, STUB);
  world.otherHost = hostOf(session.otherOrigin);
});

Then('the dialog closes and the call is denied', async ({ world }) => {
  await expect(world.requirePanel().locator('#confirm')).not.toHaveAttribute('open', '');
});

Then('the chat says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#transcript')).toContainText(text);
});

Then('the answer stops with {string}', async ({ world }, text: string) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#transcript')).toContainText(text.replace('{host}', world.otherHost));
  await expect(panel.locator('#stop')).toBeDisabled();
});

/** The stub page under another path and title: the same tools on another page of the same site. */
When('the tab moves to another page of the same site', async ({ world }) => {
  const session = await world.session();
  const stub = readFileSync(join(process.cwd(), 'test/smoke/stub-page.html'), 'utf8');
  const body = stub.replace(
    '<title>WebAIAssist smoke-test page</title>',
    '<title>Second page</title>',
  );
  session.site.routes.set('/second', { type: 'text/html; charset=utf-8', body });
  await world.page?.goto(`${await world.origin()}/second`);
});

Then('the answer continues', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#page-title')).toHaveText('Second page');
  await expect(panel.locator('#stop')).toBeEnabled();
  await expect(panel.locator('#confirm-title')).toContainText('Run the tool add');
});

Then('a note {string} is added when it ends', async ({ world }, text: string) => {
  const panel = world.requirePanel();
  await panel.click('#confirm-deny');
  await expect(panel.locator('#transcript')).toContainText(text);
});

Given('two browser windows with different allowed pages', async ({ world }) => {
  await openSite(world, { follow: true });
  const session = await world.session();
  const url = `${session.origin}/plain`;
  world.windowId = await session.worker.evaluate(async (target) => {
    const created = await chrome.windows.create({ url: target, focused: false });
    return created?.id ?? -1;
  }, url);
  await expect(world.requirePanel().locator('#page-status')).toContainText('2 WebMCP tools');
});

When('I focus the second window', async ({ world }) => {
  const session = await world.session();
  await session.worker.evaluate(async (id) => {
    await chrome.windows.update(id, { focused: true });
  }, world.windowId ?? -1);
});

Then("the card shows the second window's active page", async ({ world }) => {
  await expect(world.requirePanel().locator('#page-status')).toContainText('no WebMCP tools');
});
