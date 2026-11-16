// SPDX-License-Identifier: Apache-2.0
// Steps of the redesigned panel (features 01, 02, 06, 07 and 16): the welcome screen and Help,
// the tools list, the sign on a warning, the banner for a refused endpoint, the announcement
// rules, reduced motion and zoom.
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openPanelFor, openPoisonPage, openThirtyPage } from '../../smoke/harness';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';
import { openOptions } from './setup.steps';
import {
  askAndSettle,
  ensureSite,
  modelRequests,
  openSitePanel,
  scriptedReady,
} from './site-helpers';

async function openFrom(
  world: World,
  opener: (s: Awaited<ReturnType<World['session']>>) => Promise<{ tabId: number }>,
): Promise<void> {
  const { tabId } = await opener(await world.session());
  world.tabId = tabId;
  await openSitePanel(world);
}

// ---- the welcome screen and Help ---------------------------------------------------------------

Given('WebAIAssist is installed for the first time', async ({ world }) => {
  await world.session();
});

When('I open the side panel', async ({ world }) => {
  await ensureSite(world);
});

Then('the welcome screen shows what WebAIAssist does in three steps', async ({ world }) => {
  const steps = world.requirePanel().locator('#first-run ol li');
  await expect(steps).toHaveCount(3);
  await expect(steps.first()).toBeVisible();
});

Then('the welcome screen names the model that was picked and why', async ({ world }) => {
  await expect(world.requirePanel().locator('#first-run-model')).toContainText(
    /^We start with .+ Why: /,
  );
});

Then('the welcome screen says that chats and pages stay on this computer', async ({ world }) => {
  await expect(world.requirePanel().locator('#first-run')).toContainText(
    'questions, the page text and the answers stay on this computer',
  );
});

Then(
  'the welcome screen says that the answers come from an AI model and can be wrong',
  async ({ world }) => {
    await expect(world.requirePanel().locator('#first-run')).toContainText(
      'written by an AI model and can be wrong',
    );
  },
);

When('I close and reopen the side panel', async ({ world }) => {
  if (world.tabId === undefined) throw new Error('open a page first');
  await world.requirePanel().close();
  world.panel = await openPanelFor(await world.session(), world.tabId);
});

Then('the welcome screen is hidden', async ({ world }) => {
  await expect(world.requirePanel().locator('#first-run')).toBeHidden();
});

/** Both "Given the welcome screen is shown" and "Then ...": opens the panel when none is open. */
Then('the welcome screen is shown', async ({ world }) => {
  if (!world.panel) await ensureSite(world);
  await expect(world.requirePanel().locator('#first-run')).toBeVisible();
});

// ---- answers come from an AI --------------------------------------------------------------------

Then('the answer is labelled as written by an AI', async ({ world }) => {
  const panel = world.requirePanel();
  await askAndSettle(world, 'Hello');
  const label = panel.locator('#transcript li.assistant .who').first();
  await expect(label).toHaveText('WebAIAssist');
  const drawn = await label.evaluate((el) => getComputedStyle(el, '::after').content);
  expect(drawn).toBe('"AI"');
  await expect(label).toHaveAttribute('title', /can be wrong/);
});

Then('the panel shows a permanent note that answers can be wrong', async ({ world }) => {
  await expect(world.requirePanel().locator('#ai-note')).toBeVisible();
  await expect(world.requirePanel().locator('#ai-note')).toContainText(
    'written by an AI model and can be wrong',
  );
});

// ---- the tools list ----------------------------------------------------------------------------------

/** The row of the tool `name`, and the mark it must carry: a changing tool also has a sign. */
async function expectMark(world: World, name: string, mark: 'reads' | 'changes'): Promise<void> {
  const panel = world.requirePanel();
  const row = panel
    .locator('#tools-rows li')
    .filter({ has: panel.locator('code', { hasText: new RegExp(`^${name}$`) }) });
  await expect(row.locator(`.mark.${mark}`)).toBeVisible();
  // Colour is not the only signal: a tool that may change something also carries a sign.
  await expect(row.locator('.sign')).toHaveCount(mark === 'changes' ? 1 : 0);
}

Then('the list shows {string} marked as may change something', ({ world }, name: string) =>
  expectMark(world, name, 'changes'),
);

Then('the list shows {string} marked as reads', ({ world }, name: string) =>
  expectMark(world, name, 'reads'),
);

Then('each tool shows the first sentence of its description', async ({ world }) => {
  const html = readFileSync(join(process.cwd(), 'test/smoke/stub-page.html'), 'utf8');
  // The page also holds the description of a tool it registers later; only two are registered.
  const sentences = [...html.matchAll(/description: '([^']+)'/g)]
    .slice(0, 2)
    .map((m) => m[1] as string);
  const shown = await world.requirePanel().locator('#tools-rows .what').allTextContents();
  expect(shown.sort()).toEqual(sentences.sort());
});

Then('the tools button says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#tools-toggle')).toHaveText(text);
});

Given('a page registers a tool whose description contains a turn marker', async ({ world }) => {
  await openFrom(world, (session) => openPoisonPage(session));
  await expect(world.requirePanel().locator('#page-status')).toContainText('WebMCP tool');
});

Then(
  'the tools list shows that tool as not offered to the model, with the reason',
  async ({ world }) => {
    const rows = world.requirePanel().locator('#tools-rows');
    await expect(rows).toContainText('fine');
    const evil = rows.locator('li[data-tool="evil"]');
    await expect(evil.locator('.mark.not-offered')).toHaveText('not offered to the model');
    await expect(evil).toContainText('could pass for the assistant’s own markers');
    await expect(rows.locator('li[data-tool="fine"] .mark.not-offered')).toHaveCount(0);
  },
);

Then('the model is not told about it', async ({ world }) => {
  await scriptedReady(world);
  await askAndSettle(world, 'What can I do here?');
  const sent = JSON.stringify(await modelRequests(world.requirePanel()));
  expect(sent).toContain('fine');
  expect(sent).not.toContain('evil');
  expect(sent).not.toContain('im_start');
});

Given('a page with thirty WebMCP tools', async ({ world }) => {
  await openFrom(world, (session) => openThirtyPage(session));
  await expect(world.requirePanel().locator('#page-status')).toContainText('30 WebMCP tools');
});

Then('the list scrolls inside the card and the question box stays in view', async ({ world }) => {
  const panel = world.requirePanel();
  // A side panel is as tall as the window; the test window is 420 by 900 pixels.
  await panel.setViewportSize({ width: 420, height: 900 });
  await expect(panel.locator('#tools-rows li')).toHaveCount(30);
  const card = await panel.locator('#page-card').evaluate((el) => ({
    scrolls: el.scrollHeight > el.clientHeight,
    overflow: getComputedStyle(el).overflowY,
    height: el.clientHeight,
    viewport: window.innerHeight,
  }));
  expect(card.scrolls).toBe(true);
  expect(card.overflow).toBe('auto');
  expect(card.height).toBeLessThanOrEqual(card.viewport * 0.4 + 1);
  await expect(panel.locator('#question')).toBeInViewport({ ratio: 1 });
  await expect(panel.locator('#send')).toBeInViewport({ ratio: 1 });
});

// ---- a tool that may change something -------------------------------------------------------------

Given('a confirmation for a tool that may change something is open', async ({ world }) => {
  await ensureSite(world);
  const panel = world.requirePanel();
  await scriptedReady(world);
  await panel.fill('#question', '/tool add {"a": 1, "b": 2}');
  await panel.press('#question', 'Control+Enter');
  await panel.locator('#confirm-allow').click();
  await expect(panel.locator('#confirm-title')).toHaveText('Run the tool add?');
});

Then('the dialog shows a warning sign next to the warning text', async ({ world }) => {
  const warning = world.requirePanel().locator('#confirm-body p.warning');
  await expect(warning).toContainText('may change something');
  await expect(warning.locator('.sign')).toBeVisible();
  await expect(warning.locator('.sign')).toHaveAttribute('aria-hidden', 'true');
});

// ---- a refused endpoint ---------------------------------------------------------------------------

Given('the endpoint answers {int}', async ({ world }, status: number) => {
  const session = await world.session();
  session.site.routes.set('/v1/models', { status, body: 'refused' });
  await openOptions(world);
  const options = world.options as Page;
  await options.getByLabel('A chat endpoint (OpenAI-compatible)', { exact: true }).check();
  await options.fill('#endpoint-url', `${session.origin}/v1`);
  await options.fill('#endpoint-model', 'qwen3:0.6b');
  await options.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(options.locator('#options-status')).toHaveText('Saved.');
  await options.close();
  world.options = undefined;
  await ensureSite(world);
  await world.requirePanel().selectOption('#model', 'endpoint');
});

Then(
  'the banner says that the endpoint refused the request and to check the API key in Options',
  async ({ world }) => {
    const banner = world.requirePanel().locator('#error-banner');
    await expect(banner).toBeVisible();
    await expect(banner.locator('#error-text')).toHaveText(
      await world.fill('The endpoint at {host} refused the request. Check the API key in Options.'),
    );
    await expect(banner.getByRole('button', { name: 'Open Options', exact: true })).toBeVisible();
  },
);
