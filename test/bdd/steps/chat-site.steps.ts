// SPDX-License-Identifier: Apache-2.0
// Steps about page markup in a tool result and the chat of each site (features 09 and 14).
import { expect, type Page } from '@playwright/test';
import { openPage } from '../../smoke/harness';
import { Given, Then, When } from './fixtures';
import {
  askAndSettle,
  openSite,
  openSitePanel,
  openTab,
  scriptedReady,
  STUB,
} from './site-helpers';
import { openOptions } from './setup.steps';

const hostOf = (origin: string): string => new URL(origin).host;

Given('a page whose tool returns {string}', async ({ world }, result: string) => {
  const session = await world.session();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Markup</title></head><body>
<p id="status">markup page</p><script type="module">
document.modelContext.registerTool({ name: 'markup', description: 'Returns markup.',
  inputSchema: { type: 'object', properties: {} }, execute: () => ${JSON.stringify(result)} });
</script></body></html>`;
  session.site.routes.set('/markup', { type: 'text/html; charset=utf-8', body: html });
  const { page, tabId } = await openPage(session, session.origin, '/markup', 'markup page');
  world.page = page;
  world.tabId = tabId;
  await openSitePanel(world);
  await scriptedReady(world);
});

When('I ask for that tool and allow it', async ({ world }) => {
  await askAndSettle(world, '/tool markup {}', { allowTools: true });
});

Then('the conversation shows the characters as text', async ({ world }) => {
  const transcript = world.requirePanel().locator('#transcript');
  await expect(transcript).toContainText('<img src=x onerror=alert(1)>');
  await expect(transcript.locator('img')).toHaveCount(0);
});

Then('no script ran in the panel', async ({ world }) => {
  const alerted = await world
    .requirePanel()
    .evaluate(() => (window as unknown as { __alerted?: boolean }).__alerted === true);
  expect(alerted).toBe(false);
});

Given('Memory is on and a chat was held on site A', async ({ world }) => {
  await openSite(world, { follow: true });
  await scriptedReady(world);
  await askAndSettle(world, 'hello from site A');
});

When('I switch to site B and back to site A', async ({ world }) => {
  const session = await world.session();
  const { page } = await openTab(world, 'b', session.otherOrigin, STUB);
  const panel = world.requirePanel();
  await expect(panel.locator('#page-status')).toContainText(hostOf(session.otherOrigin));
  await expect(panel.locator('#transcript li')).toHaveCount(0);
  void page;
  await world.pages.get('first')?.page.bringToFront();
});

Then('the chat of site A is shown', async ({ world }) => {
  const transcript = world.requirePanel().locator('#transcript');
  await expect(transcript).toContainText('hello from site A');
  await expect(transcript).toContainText('Scripted reply to: hello from site A');
});

Given('Memory is off', async ({ world }) => {
  await openOptions(world);
  const options = world.options as Page;
  await options.getByLabel('Remember chats and tool results per site', { exact: true }).uncheck();
  await options.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(options.locator('#options-status')).toHaveText('Saved.');
  await options.close();
  world.options = undefined;
  world.focusOn('panel');
});

When('I switch to another site', async ({ world }) => {
  const session = await world.session();
  await openSite(world, { follow: true });
  await openTab(world, 'other', session.otherOrigin, STUB);
});

Then('the chat shows {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#chat-empty')).toHaveText(text);
});
