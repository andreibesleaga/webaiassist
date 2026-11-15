// SPDX-License-Identifier: Apache-2.0
// The tool security review in the built extension: a page with one tool for each rule. Every such
// tool is marked "check" with its reason, the clean tool is not, a flagged tool is asked about even
// when the mode is "ask only for tools that change something", a tool is run by hand from its detail
// view through the same question, and the toolbar number counts the tools of an allowed site only.
import { expect, test } from '@playwright/test';
import { askPanel, startScripted, useConfirmMode } from '../../scripts/eval/conformance-run.ts';
import { openPanelFor, openReviewPage, startSession, type Session } from './harness';

let session: Session;
test.beforeAll(async () => {
  session = await startSession();
});
test.afterAll(async () => {
  await session.close();
});

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

async function openList(): Promise<import('@playwright/test').Page> {
  const { tabId } = await openReviewPage(session);
  const panel = await openPanelFor(session, tabId);
  await panel.click('#tools-toggle');
  return panel;
}

test('each tool of the review page is marked "check" with its reason; the clean one is not', async () => {
  const panel = await openList();
  const row = (name: string) => panel.locator(`#tools-rows li[data-tool="${name}"]`);
  for (const [name, reason] of Object.entries(REASONS)) {
    await expect(row(name), name).toContainText('check');
    await expect(row(name), name).toContainText(reason);
  }
  await expect(row('review_fine')).not.toContainText('check');
  await panel.close();
});

test('a flagged tool is asked about even in the mode that skips read-only tools', async () => {
  const { tabId } = await openReviewPage(session);
  const panel = await openPanelFor(session, tabId);
  await useConfirmMode(panel, 'per-site');
  await startScripted(panel);
  const clean = await askPanel(panel, '/tool review_fine {}');
  expect(clean.questions).not.toContain('Run the tool review_fine?');
  const flagged = await askPanel(panel, '/tool review_link {}');
  expect(flagged.questions).toContain('Run the tool review_link?');
  await panel.close();
});

test('a tool is run by hand from its detail view, after the question', async () => {
  const panel = await openList();
  await panel.getByRole('button', { name: 'Open the tool review_fine' }).click();
  await panel.getByRole('button', { name: 'Run…' }).click();
  await expect(panel.locator('#confirm-title')).toHaveText('Run the tool review_fine?');
  await panel.click('#confirm-allow');
  await expect(panel.locator('#transcript')).toContainText('ran review_fine');
  await panel.close();
});

test('the toolbar number counts the tools of an allowed site only', async () => {
  const { page, tabId } = await openReviewPage(session);
  const text = () =>
    session.worker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
  await page.reload();
  await expect.poll(text).toMatch(/^1[01]$/);
  const local = await openReviewPage(session, session.localOrigin);
  const localText = await session.worker.evaluate(
    (id) => chrome.action.getBadgeText({ tabId: id }),
    local.tabId,
  );
  expect(localText).toBe('');
});
