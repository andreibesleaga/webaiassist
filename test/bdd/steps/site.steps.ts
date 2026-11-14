// SPDX-License-Identifier: Apache-2.0
// Steps about what a site publishes besides WebMCP (features 10, 11 and 12): files served by
// the test server, the chips and facts in the card, the "no AI input" signal, and what the
// scripted model is sent. A Given step only sets up files; the site opens when a step needs it.
import { expect } from '@playwright/test';
import { openPage } from '../../smoke/harness';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';
import {
  askAndSettle,
  chipTexts,
  ensureSite,
  fileRoute,
  hitsSince,
  modelRequests,
  openSitePanel,
  scriptedReady,
  setRoute,
  SITE_PATHS,
  toolMessages,
} from './site-helpers';

Given('a site that is not allowed yet', async ({ world }) => {
  const session = await world.session();
  world.notAllowedYet = true;
  const { page, tabId } = await openPage(session, session.localOrigin, '/', 'registered 2 tools');
  world.page = page;
  world.tabId = tabId;
  world.hitsBefore = session.site.hits.length;
  await setRoute(world, '/llms.txt');
});

When('the side panel shows that site', async ({ world }) => {
  const panel = await openSitePanel(world);
  await expect(panel.locator('#page-status')).toContainText('not allowed yet');
});

Then('no request was made to the site and no script was run in its tab', async ({ world }) => {
  const asked = (await hitsSince(world)).filter((hit) => SITE_PATHS.includes(hit.path));
  expect(asked).toEqual([]);
  await expect(world.requirePanel().locator('#site-chips li')).toHaveCount(0);
});

Given('an allowed site whose published index names a file on another host', async ({ world }) => {
  const session = await world.session();
  const peer = `${session.otherOrigin}/steal.txt`;
  const route = fileRoute('/.well-known/knowledge-linkset', session.origin);
  const body = (route.body as string).replace(
    '"linkset":[{',
    `"linkset":[{"alternate":[{"href":"${peer}"}],`,
  );
  await setRoute(world, '/.well-known/knowledge-linkset', { ...route, body });
  await setRoute(world, '/llms.txt', {
    body: `# Site\n## Links\n- [Elsewhere](${peer}): other host\n`,
  });
});

Then("every request went to the site's own address", async ({ world }) => {
  await ensureSite(world);
  const session = await world.session();
  const asked = (await hitsSince(world)).filter((hit) => SITE_PATHS.includes(hit.path));
  expect(asked.length).toBeGreaterThan(0);
  for (const hit of asked) {
    expect(hit.host).toBe(new URL(session.origin).host);
    expect([hit.cookie, hit.referer]).toEqual([false, false]);
  }
});

Then('the other host was not contacted', async ({ world }) => {
  const session = await world.session();
  const other = (await hitsSince(world)).filter(
    (hit) => hit.host === new URL(session.otherOrigin).host,
  );
  expect(other).toEqual([]);
});

const publishes = async ({ world }: { world: World }, path: string): Promise<void> => {
  await setRoute(world, path);
};
Given('an allowed site that publishes {string}', publishes);
// The single scenario writes the path without quotes: a "/" would be an alternative in a
// Cucumber expression, so this one is a regular expression.
Given(/^an allowed site that publishes (\/\S+)$/, publishes);

Then(
  'the card shows a chip {string}, marked as published by the site',
  async ({ world }, label: string) => {
    await ensureSite(world);
    const chip = world.requirePanel().locator('#site-chips li', { hasText: label });
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveAttribute('title', /Published by the site/);
  },
);

Then('the card shows a chip {string}', async ({ world }, label: string) => {
  await ensureSite(world);
  const texts = (await chipTexts(world.requirePanel())).map((text) => text.toLowerCase());
  expect(texts).toContain(label.toLowerCase());
});

When('I ask a question about the site', async ({ world }) => {
  await ensureSite(world);
  await scriptedReady(world);
  await askAndSettle(world, 'What is this site?');
});

When('I ask a question', async ({ world }) => {
  await ensureSite(world);
  await scriptedReady(world);
  await askAndSettle(world, 'What is this site?');
});

Then(
  'the model receives the text of that file as untrusted data labelled with its source path',
  async ({ world }) => {
    const facts = (await toolMessages(world)).find((text) => text.includes('/llms.txt'));
    expect(facts).toContain('trust="untrusted"');
    expect(facts).toContain(`Published by ${await world.origin()} in /llms.txt:`);
  },
);

Given('a site that answers 200 with an HTML page for every unknown path', async ({ world }) => {
  (await world.session()).site.softNotFound = true;
});

Then('no chip is shown and no error is shown', async ({ world }) => {
  await ensureSite(world);
  const panel = world.requirePanel();
  await expect(panel.locator('#site-chips li')).toHaveCount(0);
  await expect(panel.locator('#error-banner')).toBeHidden();
});

Given(
  'a site that publishes a 5 MB llms.txt and one that never finishes sending',
  async ({ world }) => {
    const filler = '- [Item](https://example.test/item): a line of the very long guide\n'.repeat(
      80_000,
    );
    await setRoute(world, '/llms.txt', { body: `# Big guide\n## Items\n${filler}` });
    await setRoute(world, '/.well-known/security.txt', { stall: true });
  },
);

Then(
  'the first is cut at the cap and the second is dropped at the time limit',
  async ({ world }) => {
    await ensureSite(world);
    const texts = await chipTexts(world.requirePanel());
    expect(texts).toContain('llms.txt');
    expect(texts).not.toContain('security.txt');
  },
);

Then('the panel stays usable', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#question')).toBeEnabled();
  await expect(panel.locator('#page-status')).toContainText('WebMCP tools');
});

Given('an allowed site whose files are missing or broken', async ({ world }) => {
  await setRoute(world, '/llms.txt', { status: 500, body: 'oops' });
  await setRoute(world, '/.well-known/knowledge-linkset', {
    type: 'application/linkset+json',
    body: '{"linkset": [',
  });
  await setRoute(world, '/robots.txt', { status: 503, body: 'down' });
  await setRoute(world, '/.well-known/agent-card.json', { type: 'text/html', body: '<p>page</p>' });
});

Then('the card shows no chip for them and no error banner', async ({ world }) => {
  await ensureSite(world);
  const panel = world.requirePanel();
  await expect(panel.locator('#site-chips li')).toHaveCount(0);
  await expect(panel.locator('#error-banner')).toBeHidden();
});

Given('an allowed site whose llms.txt says {string}', async ({ world }, line: string) => {
  await setRoute(world, '/llms.txt', {
    body: `# Guide\n> ${line}\n## Notes\n- [x](https://example.test/x)\n`,
  });
});

Given('whose linkset names a WebMCP surface', async ({ world }) => {
  await setRoute(world, '/.well-known/knowledge-linkset');
});

Then('the model receives the text fenced as untrusted data', async ({ world }) => {
  const facts = (await toolMessages(world)).find((text) => text.includes('delete_all'));
  expect(facts).toContain('<tool-result tool="site-file__llms.txt" trust="untrusted">');
});

Then('the tool list has no new entry', async ({ world }) => {
  const system = ((await modelRequests(world.requirePanel()))[0] ?? [])[0]?.content ?? '';
  expect(system).not.toContain('delete_all');
  expect(system).toMatch(/\badd\b/);
  expect(system).toMatch(/\becho\b/);
});
