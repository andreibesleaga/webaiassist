// SPDX-License-Identifier: Apache-2.0
// Accessibility check of the built extension in Chromium (set-up in harness.ts): axe-core
// with the WCAG 2.2 A and AA rules, colour contrast included, on the side panel (at rest,
// with Help open, with a conversation, in dark mode), the confirmation dialog and the
// Options page; and a keyboard-only run of each. Results are summarised in docs/A11Y.md.
import { expect, test } from '@playwright/test';
import { axe, focusVisible, tabOrder, webllmOptionCount } from './a11y-helpers';
import { openPanel, startSession, type Session } from './harness';

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
});
test.afterEach(async () => {
  await session.close();
});

test('side panel: no axe violations at rest, with Help, in dark mode', async () => {
  const panel = await openPanel(session);
  await expect(panel.locator('#page-status')).toContainText('2 WebMCP tools');
  expect(await axe(panel)).toEqual([]);
  await panel.click('#help-toggle');
  expect(await axe(panel)).toEqual([]);
  await panel.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(panel)).toEqual([]);
});

test('side panel: fits a 320 px wide panel without sideways scrolling', async () => {
  const panel = await openPanel(session);
  await panel.setViewportSize({ width: 320, height: 700 });
  await panel.click('#help-toggle');
  const overflow = await panel.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(await axe(panel)).toEqual([]);
});

test('side panel: every control in a sensible Tab order, each with a visible focus', async () => {
  const panel = await openPanel(session);
  await expect(panel.locator('#page-status')).toContainText('2 WebMCP tools');
  await panel.click('#first-run-ok');
  // A new page load starts the Tab walk at the top; the welcome screen stays away (it was answered).
  await panel.reload();
  await expect(panel.locator('#page-status')).toContainText('2 WebMCP tools');
  await expect(panel.locator('#first-run')).toBeHidden();
  const { ids, shown } = await tabOrder(panel, 10);
  expect(ids).toEqual([
    'help-toggle',
    'open-options',
    'read-page',
    'more-toggle',
    'tools-toggle',
    'model',
    'start',
    'conversation',
    'question',
    'send',
  ]);
  expect(shown).toEqual(ids.map(() => true));
});

test('side panel on the first run: welcome screen axe-clean, its buttons reachable', async () => {
  const panel = await openPanel(session);
  await expect(panel.locator('#first-run')).toBeVisible();
  await expect(panel.locator('#first-run-title')).toBeFocused();
  expect(await axe(panel)).toEqual([]);
  await panel.keyboard.press('Tab');
  await expect(panel.locator('#first-run-ok')).toBeFocused();
  expect(await focusVisible(panel)).toBe(true);
  await panel.keyboard.press('Tab');
  await expect(panel.locator('#first-run-other')).toBeFocused();
});

test('Help opens and closes from the keyboard and gives the focus back', async () => {
  const panel = await openPanel(session);
  await panel.focus('#help-toggle');
  await panel.keyboard.press('Enter');
  await expect(panel.locator('#help')).toBeVisible();
  await expect(panel.locator('#help-toggle')).toHaveAttribute('aria-expanded', 'true');
  await panel.focus('#help-close');
  await panel.keyboard.press('Enter');
  await expect(panel.locator('#help')).toBeHidden();
  await expect(panel.locator('#help-toggle')).toBeFocused();
});

test('confirmation dialog: axe-clean, Deny first, Tab stays inside, Escape denies', async () => {
  const panel = await openPanel(session);
  await panel.selectOption('#model', 'scripted');
  await panel.focus('#start');
  await panel.keyboard.press('Enter');
  await expect(panel.locator('#model-status')).toHaveText('Ready: Scripted test model.');
  await panel.focus('#question');
  await panel.keyboard.type('/tool add {"a": 1, "b": 1}');
  await panel.keyboard.press('Control+Enter');

  await expect(panel.locator('#confirm-title')).toContainText('Use the tools of');
  expect(await axe(panel)).toEqual([]);
  await expect(panel.locator('#confirm-deny')).toBeFocused();
  await panel.keyboard.press('Tab');
  await expect(panel.locator('#confirm-allow')).toBeFocused();
  expect(await focusVisible(panel)).toBe(true);
  await panel.keyboard.press('Tab');
  await expect(panel.locator('#confirm-deny')).toBeFocused();
  await panel.keyboard.press('Shift+Tab');
  await expect(panel.locator('#confirm-allow')).toBeFocused();
  await panel.keyboard.press('Enter');

  await expect(panel.locator('#confirm-title')).toHaveText('Run the tool add?');
  await panel.keyboard.press('Escape');
  await expect(panel.locator('#transcript')).toContainText('denied');
  await expect(panel.locator('#confirm')).not.toHaveAttribute('open', '');
  await expect(panel.locator('#question')).toBeFocused();
  expect(await axe(panel)).toEqual([]);
});

test('Options page: no axe violations, all fields by Tab, saved with the keyboard', async () => {
  const options = await session.context.newPage();
  await options.goto(`chrome-extension://${session.extensionId}/options.html`);
  await expect(options.locator('#webllm-model option')).toHaveCount(
    await webllmOptionCount(options),
  );
  expect(await axe(options)).toEqual([]);
  await options.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(options)).toEqual([]);
  const { ids, shown } = await tabOrder(options, 11);
  expect(shown).toEqual(ids.map(() => true));
  // Automatic is the chosen radio; the fields of the other runtimes are hidden until chosen.
  expect(ids).toEqual([
    'rt-auto',
    'cm-every',
    'max-steps',
    'memory',
    'clear-memory',
    'site-facts',
    'language',
    'forget-all',
    'diagnostics',
    'save',
    'reset',
  ]);
  await options.focus('#max-steps');
  await options.keyboard.press('ArrowUp');
  await options.focus('#save');
  await options.keyboard.press('Enter');
  await expect(options.locator('#options-status')).toHaveText('Saved.');
});
