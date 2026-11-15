// SPDX-License-Identifier: Apache-2.0
// The activity log in the built extension: a question in the side panel adds an entry, the
// "Activity log" button of the More area opens the explorer page on the Activity view (also on a page
// that is not a node), the two exports have the documented shape, Clear and "Forget this site" remove
// entries, and the API key never appears in the page or in an export.
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, test, type Page } from '@playwright/test';
import { askPanel, startScripted } from '../../scripts/eval/conformance-run.ts';
import { EXPORT_SCHEMA } from '../../src/core/activity-schema';
import { axe } from './a11y-helpers';
import { openPanelFor, openStubPage, startSession, type Session } from './harness';

let session: Session;
const KEY = 'sk-smoke-secret-0123456789';

test.beforeEach(async () => {
  session = await startSession();
  await session.worker.evaluate(async (key) => {
    const area = chrome.storage.local;
    const stored = await area.get('settings');
    const settings = (stored.settings ?? {}) as Record<string, unknown>;
    const endpoint = { ...(settings.endpoint as object | undefined), apiKey: key };
    await area.set({ settings: { ...settings, version: settings.version ?? 1, endpoint } });
  }, KEY);
});
test.afterEach(async () => {
  await session.close();
});

async function askEcho(panel: Page, text: string): Promise<void> {
  await startScripted(panel);
  const seen = await askPanel(panel, `/tool echo ${JSON.stringify({ text })}`);
  expect(seen.timedOut).toBe(false);
}

async function openActivity(panel: Page): Promise<Page> {
  if ((await panel.locator('#more[open]').count()) === 0) await panel.click('#more-toggle');
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-activity');
  const explorer = await opened;
  await explorer.waitForLoadState('domcontentloaded');
  await expect(explorer.getByRole('log', { name: /activity/i })).toBeVisible();
  return explorer;
}

async function saved(explorer: Page, button: string): Promise<string> {
  const download = explorer.waitForEvent('download');
  await explorer.getByRole('button', { name: button }).click();
  const path = await (await download).path();
  return readFileSync(path, 'utf8');
}

test('a question adds an entry; the Activity view opens from More with only its own tab', async () => {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  await askEcho(panel, 'hello');
  const explorer = await openActivity(panel);
  const log = explorer.getByRole('log', { name: /activity/i });
  await expect(log).toContainText('echo');
  await expect(log).toContainText('127.0.0.1');
  await expect(explorer.getByRole('tab')).toHaveCount(1);
  await expect(explorer.getByRole('tab', { name: 'Activity' })).toBeVisible();
  await expect(explorer.getByRole('checkbox', { name: /Include content/ })).not.toBeChecked();
});

test('both exports have the documented shape and hold no key and no text', async () => {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  await askEcho(panel, KEY);
  const explorer = await openActivity(panel);
  await expect(explorer.getByRole('log', { name: /activity/i })).toContainText('echo');
  const json = await saved(explorer, 'Export JSON');
  const doc = JSON.parse(json) as { format: string; questions: { tools: { name: string }[] }[] };
  expect(new Ajv2020({ strict: true }).validate(EXPORT_SCHEMA, doc)).toBe(true);
  expect(doc.format).toBe('webaiassist-activity');
  expect(doc.questions[0]?.tools[0]?.name).toBe('echo');
  const csv = await saved(explorer, 'Export CSV');
  expect(csv.split('\n')[0]).toContain('time');
  expect(csv).toContain('echo');
  for (const text of [json, csv, (await explorer.content()) + (await explorer.innerText('body'))]) {
    expect(text).not.toContain(KEY);
  }
});

test('with include content on, the key is still removed from what is kept', async () => {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  const first = await openActivity(panel);
  await first.getByRole('checkbox', { name: /Include content/ }).check();
  await first.waitForTimeout(300);
  await first.close();
  await askEcho(panel, `my key is ${KEY}`);
  const explorer = await openActivity(panel);
  const json = await saved(explorer, 'Export JSON');
  expect(json).toContain('echo');
  expect(json).toContain('my key is');
  expect(json).not.toContain(KEY);
  expect(await explorer.innerText('body')).not.toContain(KEY);
});

test('Clear asks inside the page, and then empties the log', async () => {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  await askEcho(panel, 'hello');
  const explorer = await openActivity(panel);
  const log = explorer.getByRole('log', { name: /activity/i });
  await expect(log).toContainText('echo');
  await explorer.getByRole('button', { name: 'Clear' }).click();
  await expect(explorer.getByRole('alertdialog')).toContainText('cannot be undone');
  await explorer.getByRole('button', { name: 'Keep' }).click();
  await expect(log).toContainText('echo');
  await explorer.getByRole('button', { name: 'Clear' }).click();
  await explorer.getByRole('button', { name: 'Remove all' }).click();
  await expect(log).toContainText('No questions are logged yet');
});

test('"Forget this site" removes the entries of that site', async () => {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  await askEcho(panel, 'hello');
  await panel.click('#more-toggle');
  await panel.click('#forget');
  // The smoke build holds its site access as a required permission, which Chrome will not remove:
  // the note then says so, after the entries and the chat were removed (forget-site.ts order).
  await expect(panel.locator('#page-note')).not.toHaveText('');
  const explorer = await openActivity(panel);
  await expect(explorer.getByRole('log', { name: /activity/i })).toContainText(
    'No questions are logged yet',
  );
});

test('the Activity view has no axe violations and its buttons are reached by Tab', async () => {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  await askEcho(panel, 'hello');
  const explorer = await openActivity(panel);
  await expect(explorer.getByRole('log', { name: /activity/i })).toContainText('echo');
  expect(await axe(explorer)).toEqual([]);
  await explorer.getByRole('tab', { name: 'Activity' }).focus();
  for (let i = 0; i < 12; i += 1) await explorer.keyboard.press('Tab');
  await expect(explorer.locator('*:focus')).toBeVisible();
});
