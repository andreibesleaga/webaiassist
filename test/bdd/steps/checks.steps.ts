// SPDX-License-Identifier: Apache-2.0
// Steps for accessibility, keyboard use, privacy and the bundled model library.
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { axe, focusVisible, tabOrder } from '../../smoke/a11y-helpers';
import { Then, When } from './fixtures';

When('the browser prefers a dark colour scheme', async ({ world }) => {
  await world.target().emulateMedia({ colorScheme: 'dark' });
});

When('the panel is 320 pixels wide', async ({ world }) => {
  await world.requirePanel().setViewportSize({ width: 320, height: 700 });
});

When('I press Tab through the panel', async ({ world }) => {
  world.tabs = await tabOrder(world.requirePanel(), 10);
});

When('I press Tab twice', async ({ world }) => {
  const panel = world.requirePanel();
  await panel.keyboard.press('Tab');
  await panel.keyboard.press('Tab');
});

Then('the panel has no accessibility violations', async ({ world }) => {
  expect(await axe(world.target())).toEqual([]);
});

Then('the panel does not scroll sideways', async ({ world }) => {
  const overflow = await world
    .requirePanel()
    .evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

Then('the focus visits {string} in that order', ({ world }, ids: string) => {
  expect(world.tabs?.ids).toEqual(ids.split(', '));
});

Then('every focused control shows a focus ring', ({ world }) => {
  expect(world.tabs?.shown.every(Boolean)).toBe(true);
});

Then('the focus is still inside the dialog', async ({ world }) => {
  const panel = world.requirePanel();
  const inside = await panel.evaluate(() => document.activeElement?.closest('dialog') !== null);
  expect(inside).toBe(true);
  expect(await focusVisible(panel)).toBe(true);
});

Then(
  'the page line, the model line and the page note are polite status regions',
  async ({ world }) => {
    const panel = world.requirePanel();
    for (const id of ['page-status', 'model-status', 'page-note']) {
      await expect(panel.locator(`#${id}`)).toHaveAttribute('role', 'status');
    }
  },
);

Then('the conversation is a log region', async ({ world }) => {
  await expect(world.requirePanel().locator('[role="log"]')).toHaveCount(1);
});

Then("the only hosts contacted are the page's own host and the extension", async ({ world }) => {
  const session = await world.session();
  const allowed = new Set([new URL(session.origin).host, session.extensionId]);
  const local = new Set(['data:', 'blob:', 'about:', 'chrome:']);
  const hosts = world.requests
    .map((url) => new URL(url))
    .filter((url) => !local.has(url.protocol))
    .map((url) => url.host);
  expect(hosts.length, 'some requests were recorded').toBeGreaterThan(0);
  expect(hosts.filter((host) => !allowed.has(host))).toEqual([]);
});

Then('the bundled model library has the recorded SHA-256', async ({ world }) => {
  const pins = JSON.parse(readFileSync('scripts/model-libs.json', 'utf8')) as {
    libs: { file: string; sha256: string }[];
  };
  const found = await world.requirePanel().evaluate(
    async (files) => {
      const hashes: Record<string, string> = {};
      for (const file of files) {
        const bytes = await (await fetch(`model-libs/${file}`)).arrayBuffer();
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        hashes[file] = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      return hashes;
    },
    pins.libs.map((lib) => lib.file),
  );
  expect(found).toEqual(Object.fromEntries(pins.libs.map((lib) => [lib.file, lib.sha256])));
});
