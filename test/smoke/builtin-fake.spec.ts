// SPDX-License-Identifier: Apache-2.0
// Chrome's built-in model in the built extension, with a scripted `LanguageModel` in the side
// panel (headless Chromium has no model): the download from a click with progress and Cancel,
// the compact tool list that fits a small window, the reply constraint, and plain errors.
import { expect, test, type Page } from '@playwright/test';
import { openPanelFor, openStubPage, startSession, type Session } from './harness';
import {
  readLog,
  withFakeModel,
  type FakeModelConfig,
  type FakeModelLog,
} from './fake-language-model';

const ANSWER = '{"answer":"You can add numbers and echo text."}';

async function panelWith(session: Session, config: Partial<FakeModelConfig>): Promise<Page> {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(
    session,
    tabId,
    withFakeModel({ state: 'available', contextWindow: 9216, replies: [ANSWER], ...config }),
  );
  await panel.selectOption('#model', 'prompt-api');
  return panel;
}

/** A question the fake model answers without a tool: the site question is not asked. */
async function ask(panel: Page, text: string): Promise<void> {
  await panel.fill('#question', text);
  await panel.press('#question', 'Control+Enter');
  await expect(panel.locator('#confirm')).toBeHidden();
}

test('a window of 1024 tokens gets a compact tool list that still names every tool', async () => {
  const session = await startSession();
  try {
    const panel = await panelWith(session, { contextWindow: 1024 });
    await panel.click('#start');
    await expect(panel.locator('#model-status')).toContainText('Ready:');
    await ask(panel, 'What can I do here?');
    await expect(panel.locator('#transcript')).toContainText('You can add numbers and echo text.');
    const log: FakeModelLog = await readLog(panel);
    const system = log.creates.at(-1)?.initialPrompts?.[0]?.content ?? '';
    expect(system).toContain('Tools, as name(arguments): purpose');
    expect(system).toMatch(/add/);
    expect(system).toMatch(/echo/);
    expect(system).not.toContain('inputSchema');
    expect(Math.ceil(system.length / 3)).toBeLessThanOrEqual(1024 - 256);
  } finally {
    await session.close();
  }
});

test('the reply is asked for as JSON that names only the page’s tools', async () => {
  const session = await startSession();
  try {
    const panel = await panelWith(session, {});
    await panel.click('#start');
    await expect(panel.locator('#model-status')).toContainText('Ready:');
    await ask(panel, 'What can I do here?');
    await expect(panel.locator('#transcript')).toContainText('You can add numbers');
    const { prompts } = await readLog(panel);
    expect(prompts[0]?.omit).toBe(true);
    const schema = JSON.stringify(prompts[0]?.constraint);
    expect(schema).toContain('"enum":["add","echo"]');
    expect(schema).toContain('"answer"');
  } finally {
    await session.close();
  }
});

test('the download starts from the click, shows progress, and Cancel stops it', async () => {
  const session = await startSession();
  try {
    const panel = await panelWith(session, { state: 'downloadable', downloadMs: 'forever' });
    await panel.click('#start');
    // Chrome's download starts only from a click: the consent button is that click.
    await expect(panel.locator('#consent')).toBeVisible();
    expect((await readLog(panel)).creates).toHaveLength(0);
    await panel.click('#consent-ok');
    await expect(panel.locator('#model-status')).toContainText('is preparing it');
    await expect(panel.locator('#progress')).toHaveAttribute('value', '1');
    expect((await readLog(panel)).creates[0]?.active).toBe(true);
    await panel.click('#cancel-load');
    await expect(panel.locator('#model-status')).toContainText('cancelled');
    await expect.poll(async () => (await readLog(panel)).aborted).toBeGreaterThan(0);
    await expect(panel.locator('#start')).toBeEnabled();
  } finally {
    await session.close();
  }
});

test('a failed download says what to check and that Start tries again', async () => {
  const session = await startSession();
  try {
    const panel = await panelWith(session, {
      state: 'downloadable',
      failCreate: { name: 'NetworkError', message: 'Failed to download' },
    });
    await panel.click('#start');
    await panel.click('#consent-ok');
    const status = panel.locator('#model-status');
    await expect(status).toContainText('The download did not finish');
    await expect(status).toContainText('press Start again');
    await expect(panel.locator('#start')).toBeEnabled();
  } finally {
    await session.close();
  }
});

test('a question that is too long for the window is named, not left hanging', async () => {
  const session = await startSession();
  try {
    const panel = await panelWith(session, { contextWindow: 1024 });
    await panel.click('#start');
    await expect(panel.locator('#model-status')).toContainText('Ready:');
    await panel.evaluate(() => {
      const lm = (globalThis as unknown as { LanguageModel: { create: unknown } }).LanguageModel;
      const create = lm.create as (o?: object) => Promise<unknown>;
      lm.create = () =>
        Promise.reject(
          Object.assign(new DOMException('too long', 'QuotaExceededError'), {
            requested: 5000,
            contextWindow: 1024,
          }),
        );
      void create;
    });
    await ask(panel, 'What can I do here?');
    await expect(panel.locator('#transcript')).toContainText(
      "too long for Chrome's built-in model",
    );
    await expect(panel.locator('#send')).toBeEnabled();
  } finally {
    await session.close();
  }
});
