// SPDX-License-Identifier: Apache-2.0
// Steps of the processor model scenarios (features 02 and 03): the smoke build runs the real
// runtime on a fake engine, whose stored files live in localStorage and survive a restart of
// the model host.
import { expect, type Page } from '@playwright/test';
import { pageShown } from '../../smoke/harness';
import { Then, When } from './fixtures';
import { restartModelHost, startAndAgree, watchModelLine } from './setup.steps';

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const button = (name: string) => ({ name, exact: true }) as const;

/** The texts the model line showed since the observer was installed. */
const modelLines = (panel: Page): Promise<string[]> =>
  panel.evaluate(() => (window as unknown as { __modelLines?: string[] }).__modelLines ?? []);

/** The fake processor engine's stored files, which survive a restart of the model host. */
const storedFiles = (panel: Page): Promise<string[]> =>
  panel.evaluate(() => {
    const raw = localStorage.getItem('webaiassist.fake-cpu-disk');
    return raw ? Object.keys((JSON.parse(raw) as { disk: object }).disk) : [];
  });

When('the download finishes', async ({ world }) => {
  const panel = world.requirePanel();
  await startAndAgree(panel);
});

When('the connection is back and I press {string}', async ({ world }, name: string) => {
  const panel = world.requirePanel();
  await panel.getByRole('button', button(name)).click();
  await panel.locator('#consent-ok').click({ timeout: 5_000 });
});

When('I agree to the download', async ({ world }) => {
  await world.requirePanel().locator('#consent-ok').click();
});

When('I restart the browser and press {string}', async ({ world }, name: string) => {
  const panel = world.requirePanel();
  await restartModelHost(world);
  await panel.reload();
  await pageShown(panel);
  await expect(panel.locator('#model')).toHaveValue('cpu:smoke-cpu');
  await watchModelLine(panel);
  await panel.getByRole('button', button(name)).click();
});

Then('the panel says the file did not match its checksum and was deleted', async ({ world }) => {
  await expect(world.requirePanel().locator('#model-status')).toContainText(
    'did not match its checksum and was deleted',
  );
});

Then("the file is not in the browser's storage", async ({ world }) => {
  expect(await storedFiles(world.requirePanel())).toEqual([]);
});

Then('{string} downloads it again', async ({ world }, name: string) => {
  const panel = world.requirePanel();
  const before = (await modelLines(panel)).length;
  await panel.getByRole('button', button(name)).click();
  await panel.locator('#consent-ok').click({ timeout: 5_000 });
  await expect
    .poll(async () =>
      (await modelLines(panel)).slice(before).some((l) => l.startsWith('Downloading')),
    )
    .toBe(true);
});

Then('the panel says the download stopped and why', async ({ world }) => {
  await expect(world.requirePanel().locator('#model-status')).toContainText(
    'The download stopped: the connection was lost',
    { timeout: 30_000 },
  );
});

Then('no partial file is used as a model', async ({ world }) => {
  expect(await storedFiles(world.requirePanel())).toEqual([]);
  await expect(world.requirePanel().locator('#model-status')).not.toContainText('Ready');
});

Then('the download continues or starts again and the model becomes ready', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#model-status')).toContainText('Ready: ', { timeout: 30_000 });
  expect((await modelLines(panel)).some((l) => l.startsWith('Downloading'))).toBe(true);
});

Then('no download is made and the model becomes ready from the stored copy', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#model-status')).toContainText('Ready: ', { timeout: 30_000 });
  expect((await modelLines(panel)).some((l) => l.startsWith('Downloading'))).toBe(false);
});

Then('the panel says how much free memory is needed', async ({ world }) => {
  await expect(world.requirePanel().locator('#model-status')).toContainText(
    'needs about 64 MB of free memory',
    { timeout: 30_000 },
  );
});

Then('it suggests closing other tabs or choosing a smaller model', async ({ world }) => {
  await expect(world.requirePanel().locator('#model-status')).toContainText(
    'Close other tabs or choose the smaller model',
  );
});

Then(
  'the model line says {string} followed by the model name and {string}',
  async ({ world }, start: string, rest: string) => {
    const panel = world.requirePanel();
    const label = await panel.locator('#model option:checked').evaluate((o) => o.textContent ?? '');
    const name = label.split(' (')[0] ?? label;
    await expect(panel.locator('#model-status')).toHaveText(
      new RegExp(`^${start}${escape(name)}\\. ${rest}`),
    );
  },
);

Then('a question gets an answer without the graphics card being used', async ({ world }) => {
  const panel = world.requirePanel();
  await panel.fill('#question', 'hello');
  await panel.press('#question', 'Control+Enter');
  await panel
    .locator('#confirm-allow')
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await expect(panel.locator('#transcript')).toContainText('Processor model reply to: hello', {
    timeout: 30_000,
  });
  // The answer came from the processor engine: the line names it, and the fake engine is the
  // only runtime in this build that answers with that text.
  await expect(panel.locator('#model-status')).toContainText(
    'Running in this browser, on your processor and memory',
  );
});
