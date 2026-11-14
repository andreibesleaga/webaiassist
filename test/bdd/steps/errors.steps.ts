// SPDX-License-Identifier: Apache-2.0
// Steps of the error, offline and "Forget all sites" scenarios (features 05 and 13): the error
// banner, the offline note, the copied details, and what Options removes.
import { expect, type Page } from '@playwright/test';
import { pageShown } from '../../smoke/harness';
import { Given, Then, When } from './fixtures';
import { openOptions } from './setup.steps';
import { ensureSite } from './site-helpers';

const button = (name: string) => ({ name, exact: true }) as const;

// ---- errors and offline --------------------------------------------------------------------------------

Then('an error banner says {string}', async ({ world }, line: string) => {
  const banner = world.requirePanel().locator('#error-banner');
  await expect(banner).toBeVisible();
  await expect(banner.locator('#error-text')).toContainText(line);
  await expect(banner).toHaveAttribute('role', 'alert');
});

Then('it offers {string} and {string}', async ({ world }, first: string, second: string) => {
  const banner = world.requirePanel().locator('#error-banner');
  await expect(banner.getByRole('button', button(first))).toBeVisible();
  await expect(banner.getByRole('button', button(second))).toBeVisible();
});

When('the browser goes offline', async ({ world }) => {
  await (await world.session()).context.setOffline(true);
});

Given('the browser is offline', async ({ world }) => {
  await (await world.session()).context.setOffline(true);
});

Then('a note says {string}', async ({ world }, line: string) => {
  await expect(world.requirePanel().locator('#offline-banner')).toHaveText(line);
});

Then(
  'the consent block says the model is not on this computer and that the person is offline',
  async ({ world }) => {
    const panel = world.requirePanel();
    await expect(panel.locator('#consent')).toBeVisible();
    await expect(panel.locator('#consent-body')).toContainText(
      'is not on this computer and you are offline',
    );
    await expect(panel.locator('#consent-ok')).toBeHidden();
  },
);

Given('something unexpected fails', async ({ world }) => {
  const panel = world.requirePanel();
  // The copy goes to the clipboard in a real browser; here the page records what it was given.
  await panel.evaluate(() => {
    const w = window as unknown as { __copied?: string };
    Object.assign(navigator.clipboard, {
      writeText: (value: string) => {
        w.__copied = value;
        return Promise.resolve();
      },
    });
  });
  await panel.fill('#question', '/fail the model crashed');
  await panel.press('#question', 'Control+Enter');
  await expect(panel.locator('#error-banner')).toBeVisible();
});

Then('the banner says {string} and {string}', async ({ world }, first: string, second: string) => {
  const banner = world.requirePanel().locator('#error-text');
  await expect(banner).toContainText(first);
  await expect(banner).toContainText(second);
});

Then('the copied text holds the message and the version and no page content', async ({ world }) => {
  const panel = world.requirePanel();
  await expect
    .poll(() => panel.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? ''))
    .toMatch(/^WebAIAssist \d+\.\d+\.\d+\nthe model crashed$/);
});

// ---- Forget all sites ------------------------------------------------------------------------------------

/** Rows in one store of the extension's IndexedDB, read from the page that is in front. */
const rows = (page: Page, store: string): Promise<number> =>
  page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('webaiassist');
        open.onerror = () => reject(open.error ?? new Error('indexedDB did not open'));
        open.onsuccess = () => {
          const count = open.result.transaction(name).objectStore(name).count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error ?? new Error('indexedDB did not count'));
        };
      }),
    store,
  );

Then('a chat is saved for the site', async ({ world }) => {
  await expect.poll(() => rows(world.requirePanel(), 'chats')).toBeGreaterThan(0);
});

Then('no chat is saved', async ({ world }) => {
  await openOptions(world);
  expect(await rows(world.target(), 'chats')).toBe(0);
  expect(await rows(world.target(), 'toolStats')).toBe(0);
  world.focusOn('panel');
});

Given('the welcome screen was dismissed', async ({ world }) => {
  if (!world.panel) await ensureSite(world);
  const panel = world.requirePanel();
  await panel.click('#first-run-ok');
  // A new page load starts the Tab walk at the top.
  await panel.reload();
  await pageShown(panel);
  await expect(panel.locator('#first-run')).toBeHidden();
});
