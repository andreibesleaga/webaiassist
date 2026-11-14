// SPDX-License-Identifier: Apache-2.0
// Chrome's built-in model (Prompt API) in the built extension, in headless Chromium: the panel
// says what Chrome reports and never fails silently. Chromium here has `LanguageModel` and
// answers "unavailable" (no model component), which is the path Start must explain; an init
// script removes `LanguageModel` for the "not in this browser" line.
import { expect, test } from '@playwright/test';
import { openPanelFor, openStubPage, pageShown, startSession } from './harness';

test('Start with the built-in model shows Chrome’s error, its state and the requirements', async () => {
  const session = await startSession();
  try {
    const { tabId } = await openStubPage(session);
    const panel = await openPanelFor(session, tabId);
    await panel.click('#help-toggle');
    await expect(panel.locator('#builtin-state')).toContainText('unavailable on this computer');
    await panel.selectOption('#model', 'prompt-api');
    await expect(panel.locator('#model-status')).toContainText('22 GB free disk');
    await panel.click('#start');
    const status = panel.locator('#model-status');
    await expect(status).toContainText('The model did not load:', { timeout: 30_000 });
    await expect(status).toContainText("Chrome's state: unavailable");
    await expect(status).toContainText('22 GB free disk');
    await expect(panel.locator('#start')).toBeEnabled();
  } finally {
    await session.close();
  }
});

test('the panel says when this browser has no LanguageModel at all', async () => {
  const session = await startSession();
  try {
    const { tabId } = await openStubPage(session);
    const panel = await session.context.newPage();
    await panel.addInitScript(() => {
      delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
    });
    await panel.goto(`chrome-extension://${session.extensionId}/sidepanel.html?tab=${tabId}`);
    await pageShown(panel);
    await panel.click('#help-toggle');
    await expect(panel.locator('#builtin-state')).toHaveText(
      'Chrome’s built-in model: not in this browser (no Prompt API here).',
    );
    await expect(panel.locator('#model option[value="prompt-api"]')).toHaveCount(0);
  } finally {
    await session.close();
  }
});
