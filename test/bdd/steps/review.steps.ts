// SPDX-License-Identifier: Apache-2.0
// Steps of features/31-tool-review-and-parity.feature: the review page (test/smoke/review-page.html)
// with the side panel, the tools list, running a tool by hand, and the toolbar number.
import { expect } from '@playwright/test';
import { openPanelFor, openReviewPage } from '../../smoke/harness';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';

const REASONS: Readonly<Record<string, string>> = {
  review_hidden: 'hidden characters',
  review_instructions: 'orders to the AI',
  review_names: 'call another tool',
  review_paypa1: 'look-alike',
  review_link: 'web address',
  review_encoded: 'encoded text',
  delete_everything: 'Marked read-only',
  review_long: 'unusually long',
};

function panelOf(world: World) {
  if (!world.panel) throw new Error('open the panel first');
  return world.panel;
}

Given('the review page is open with the side panel', async ({ world }) => {
  const session = await world.session();
  const { page, tabId } = await openReviewPage(session);
  world.page = page;
  world.tabId = tabId;
  world.panel = await openPanelFor(session, tabId);
});

When('you open the tools list', async ({ world }) => {
  await panelOf(world).click('#tools-toggle');
});

Then(
  'every tool of the page except the clean one is marked "check" with its reason',
  async ({ world }) => {
    const panel = panelOf(world);
    const row = (name: string) => panel.locator(`#tools-rows li[data-tool="${name}"]`);
    for (const [name, reason] of Object.entries(REASONS)) {
      await expect(row(name), name).toContainText('check');
      await expect(row(name), name).toContainText(reason);
    }
    await expect(row('review_fine')).not.toContainText('check');
  },
);

When(
  'you open the tool {string} and press {string} and allow the question',
  async ({ world }, name: string, button: string) => {
    const panel = panelOf(world);
    await panel.click('#tools-toggle');
    await panel.getByRole('button', { name: `Open the tool ${name}` }).click();
    await panel.getByRole('button', { name: button }).click();
    // The first tool of a site brings the question about the site.
    const title = panel.locator('#confirm-title');
    await expect(title).toHaveText(/^(Use the tools of|Run the tool)/);
    if ((await title.textContent())?.startsWith('Use the tools of')) {
      await panel.click('#confirm-allow');
    }
    await expect(panel.locator('#confirm-title')).toHaveText(`Run the tool ${name}?`);
    await panel.click('#confirm-allow');
  },
);

Then('the transcript shows {string}', async ({ world }, text: string) => {
  await expect(panelOf(world).locator('#transcript')).toContainText(text);
});

async function badgeOf(world: World, tabId: number): Promise<string> {
  const session = await world.session();
  return session.worker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
}

Then("the toolbar number of the page's tab is the count of its tools", async ({ world }) => {
  const tabId = world.tabId;
  if (tabId === undefined) throw new Error('open a page first');
  // No reload: the number appears on the first load (the worker reads the tab again after it loads).
  await expect.poll(() => badgeOf(world, tabId), { timeout: 8_000 }).toMatch(/^1[01]$/);
});

Then('the toolbar number of the same page at localhost is empty', async ({ world }) => {
  const session = await world.session();
  const { tabId } = await openReviewPage(session, session.localOrigin);
  expect(await badgeOf(world, tabId)).toBe('');
});
