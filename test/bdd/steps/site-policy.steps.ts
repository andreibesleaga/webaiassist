// SPDX-License-Identifier: Apache-2.0
// Steps about a site that asks for no AI input, a training reservation, a page policy that
// forbids connections, and node pages (features 10, 11 and 12).
import { expect } from '@playwright/test';
import { openPage } from '../../smoke/harness';
import type { World } from '../world';
import { Given, Then } from './fixtures';
import {
  chipTexts,
  ensureSite,
  modelRequests,
  openSite,
  openSitePanel,
  setRoute,
} from './site-helpers';

Given('an allowed site whose robots.txt says {string}', async ({ world }, line: string) => {
  await setRoute(world, '/robots.txt', { body: `User-agent: *\n${line}\n` });
  await setRoute(world, '/llms.txt');
});

Then('the card says the site asks that AI does not use its content as input', async ({ world }) => {
  await ensureSite(world);
  await expect(world.requirePanel().locator('#site-ai')).toContainText(
    'asks that AI systems do not use its content as input',
  );
});

Then('{string} is not offered', async ({ world }, name: string) => {
  await ensureSite(world);
  await expect(world.requirePanel().getByRole('button', { name, exact: true })).toBeHidden();
});

Then('no text from the site is sent to the model', async ({ world }) => {
  const sent = JSON.stringify(await modelRequests(world.requirePanel()));
  expect(sent).not.toContain('Published by');
  expect(sent).not.toContain('Test site');
});

Given(
  'an allowed site whose tdmrep.json reserves text and data mining rights',
  async ({ world }) => {
    await setRoute(world, '/.well-known/tdmrep.json');
  },
);

Then('the card does not say the site blocks AI input', async ({ world }) => {
  await ensureSite(world);
  const panel = world.requirePanel();
  await expect(panel.locator('#page-status')).not.toContainText('asks that AI');
  await expect(panel.locator('#site-ai')).not.toContainText('asks that AI');
  await expect(panel.locator('#site-ai')).toContainText('rights');
});

Given(
  "an allowed site that sends a Content-Security-Policy with connect-src 'none'",
  async ({ world }) => {
    (await world.session()).site.pageHeaders = { 'content-security-policy': "connect-src 'none'" };
    await setRoute(world, '/llms.txt');
  },
);

Then('its files are still read', async ({ world }) => {
  await ensureSite(world);
  expect(await chipTexts(world.requirePanel())).toContain('llms.txt');
});

Given('an allowed node page with a knowledge linkset and llms.txt', async ({ world }) => {
  await setRoute(world, '/.well-known/knowledge-linkset');
  await setRoute(world, '/llms.txt');
  await openNode(world);
});

Given('an allowed node page that registers no tools', async ({ world }) => {
  await setRoute(world, '/.well-known/knowledge-linkset');
  await openNode(world);
});

async function openNode(world: World): Promise<void> {
  const session = await world.session();
  const { page, tabId } = await openPage(session, session.origin, '/node', 'node page');
  world.page = page;
  world.tabId = tabId;
  world.hitsBefore = session.site.hits.length;
  await openSitePanel(world);
}

Then('the card shows the node badge', async ({ world }) => {
  await ensureSite(world);
  await expect(world.requirePanel().locator('#node-badge')).toBeVisible();
});

Then('the card shows chips for the linkset and llms.txt', async ({ world }) => {
  const texts = await chipTexts(world.requirePanel());
  expect(texts).toEqual(expect.arrayContaining(['knowledge links', 'llms.txt']));
});

Then(
  'the page line says that this page has no WebMCP tools and to open an item page or press Read this page',
  async ({ world }) => {
    await ensureSite(world);
    const line = world.requirePanel().locator('#page-status');
    await expect(line).toContainText('no WebMCP tools on this page');
    await expect(line).toContainText('open an item page');
    await expect(line).toContainText('Read this page');
  },
);

Given('a site whose robots.txt says ai-input=no', async ({ world }) => {
  await setRoute(world, '/robots.txt', { body: 'User-agent: *\nContent-Signal: ai-input=no\n' });
});

Given('the side panel is open on that site', async ({ world }) => {
  await openSite(world);
});

Then(
  'the page line says that the site asks that AI does not use its content as input',
  async ({ world }) => {
    await ensureSite(world);
    await expect(world.requirePanel().locator('#page-status')).toContainText(
      'asks that AI does not use its content as input',
    );
  },
);
