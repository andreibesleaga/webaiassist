// SPDX-License-Identifier: Apache-2.0
// Accessibility of the states of the redesigned side panel, each in the light and the dark
// theme: the card with its tools list open, its More actions, a node page with chips, a site
// that asks for no AI input, the error banner, the question before a download, the welcome
// screen, and the Options page with its model list. axe-core runs the WCAG 2.2 A and AA
// rules, colour contrast included. Also the accessible names and the order of the new parts,
// reduced motion, and 200 percent zoom.
import { expect, test, type Page } from '@playwright/test';
import { fileRoute } from '../bdd/steps/site-helpers';
import { axe, focusVisible, webllmOptionCount } from './a11y-helpers';
import { openPage, openPanel, openPanelFor, startSession, type Session } from './harness';

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
});
test.afterEach(async () => {
  await session.close();
});

const THEMES = ['light', 'dark'] as const;

async function cleanInBothThemes(page: Page): Promise<void> {
  for (const scheme of THEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    expect(await axe(page), `${scheme} theme`).toEqual([]);
  }
}

async function readyPanel(): Promise<Page> {
  const panel = await openPanel(session);
  await expect(panel.locator('#page-status')).toContainText('2 WebMCP tools');
  return panel;
}

test('the card with its tools list and More actions open is axe-clean in both themes', async () => {
  const panel = await readyPanel();
  await panel.click('#tools-toggle');
  await panel.click('#more-toggle');
  await expect(panel.locator('#tools-rows li')).toHaveCount(2);
  await cleanInBothThemes(panel);
});

test('names: the card is a named section, the toggle says what it opens, marks have words', async () => {
  const panel = await readyPanel();
  await expect(panel.locator('#page-card')).toHaveAttribute('aria-labelledby', 'page-card-title');
  await expect(panel.locator('#page-card-title')).toHaveText(
    '127.0.0.1:' + new URL(session.origin).port,
  );
  await expect(panel.locator('#access-badge')).toHaveText('Allowed');
  await expect(panel.locator('#tools-toggle')).toHaveAccessibleName(
    /^Tools \(2\): 1 read, 1 may change/,
  );
  await expect(panel.locator('#tools-toggle')).toHaveAttribute('aria-controls', 'tools-list');
  // The bar is hidden (and so out of the accessibility tree) unless a model loads; it is
  // named by the Model label for the moment it shows.
  await expect(panel.locator('#progress')).toHaveAttribute('aria-labelledby', 'model-label');
  await expect(panel.locator('#model-label')).toHaveText('Model');
  await panel.click('#tools-toggle');
  const marks = await panel.locator('#tools-rows .mark').allTextContents();
  expect(marks).toEqual(expect.arrayContaining(['reads', 'changes']));
  // The warning sign is decoration; the word carries the meaning.
  await expect(panel.locator('#tools-rows .sign')).toHaveAttribute('aria-hidden', 'true');
});

test('the tools toggle keeps the focus when it opens the list, and Enter opens it', async () => {
  const panel = await readyPanel();
  await panel.focus('#tools-toggle');
  await panel.keyboard.press('Enter');
  await expect(panel.locator('#tools-list')).toBeVisible();
  await expect(panel.locator('#tools-toggle')).toBeFocused();
  await expect(panel.locator('#tools-toggle')).toHaveAttribute('aria-expanded', 'true');
  await panel.keyboard.press('Space');
  await expect(panel.locator('#tools-list')).toBeHidden();
  expect(await focusVisible(panel)).toBe(true);
});

test('the order of the card: site, status, actions, More, tools; More opens with the keyboard', async () => {
  const panel = await readyPanel();
  const order = await panel.evaluate(() =>
    [
      'page-card-title',
      'access-badge',
      'page-title',
      'page-status',
      'read-page',
      'more-toggle',
      'tools-toggle',
    ]
      .map((id) => document.getElementById(id) as HTMLElement)
      .map((el) => el.getBoundingClientRect().top + el.getBoundingClientRect().left / 10_000),
  );
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await panel.focus('#more-toggle');
  await panel.keyboard.press('Enter');
  await expect(panel.locator('#compat')).toBeVisible();
  await panel.keyboard.press('Tab');
  await expect(panel.locator('#compat')).toBeFocused();
});

test('a node page shows its badge and chips, axe-clean in both themes', async () => {
  session.site.routes.set(
    '/.well-known/knowledge-linkset',
    fileRoute('/.well-known/knowledge-linkset', session.origin),
  );
  session.site.routes.set('/llms.txt', fileRoute('/llms.txt', session.origin));
  const { tabId } = await openPage(session, session.origin, '/node', 'node page');
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#node-badge')).toBeVisible();
  await expect(panel.locator('#site-chips li').first()).toBeVisible();
  await cleanInBothThemes(panel);
});

test('a site that asks for no AI input shows the blocked badge, axe-clean in both themes', async () => {
  session.site.routes.set('/robots.txt', { body: 'User-agent: *\nContent-Signal: ai-input=no\n' });
  const panel = await openPanel(session);
  await expect(panel.locator('#access-badge')).toHaveText('Blocked by the site');
  await expect(panel.locator('#site-ai')).toBeVisible();
  await cleanInBothThemes(panel);
});

test('the error banner is an alert and is axe-clean in both themes', async () => {
  const panel = await readyPanel();
  await panel.selectOption('#model', 'scripted');
  await panel.click('#start');
  await expect(panel.locator('#model-status')).toHaveText('Ready: Scripted test model.');
  await panel.fill('#question', '/fail the model crashed');
  await panel.press('#question', 'Control+Enter');
  await expect(panel.locator('#error-banner')).toBeVisible();
  await expect(panel.locator('#error-banner')).toHaveAttribute('role', 'alert');
  await cleanInBothThemes(panel);
});

test('the question before a download is a named group and axe-clean in both themes', async () => {
  const panel = await readyPanel();
  await panel.selectOption('#model', 'cpu:smoke-cpu');
  await panel.click('#start');
  await expect(panel.locator('#consent')).toBeVisible();
  await expect(panel.locator('#consent')).toHaveAttribute('role', 'group');
  await expect(panel.locator('#consent-ok')).toBeFocused();
  await cleanInBothThemes(panel);
});

test('the welcome screen is axe-clean in both themes, and Help brings it back', async () => {
  const panel = await openPanel(session);
  await expect(panel.locator('#first-run')).toBeVisible();
  await cleanInBothThemes(panel);
  await panel.click('#first-run-ok');
  await expect(panel.locator('#first-run')).toBeHidden();
  await panel.click('#help-toggle');
  await expect(panel.locator('#first-run')).toBeVisible();
  await cleanInBothThemes(panel);
});

test('axe waits for a colour change to end: the buttons are measured in their final colours', async () => {
  const panel = await openPanel(session);
  await expect(panel.locator('#first-run')).toBeVisible();
  await panel.addStyleTag({ content: 'button { transition: background 2s linear !important; }' });
  await panel.emulateMedia({ colorScheme: 'light' });
  await panel.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await panel.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(panel), 'dark theme, straight after the switch').toEqual([]);
});

test('the Options page with the model list is axe-clean in both themes at 320 px', async () => {
  const options = await session.context.newPage();
  await options.goto(`chrome-extension://${session.extensionId}/options.html`);
  await options.setViewportSize({ width: 320, height: 700 });
  await expect(options.locator('#webllm-model option')).toHaveCount(
    await webllmOptionCount(options),
  );
  await cleanInBothThemes(options);
  const overflow = await options.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('reduced motion turns every transition off', async () => {
  const panel = await readyPanel();
  await panel.emulateMedia({ reducedMotion: 'reduce' });
  const durations = await panel.evaluate(() =>
    ['start', 'send', 'read-page', 'help-toggle'].map(
      (id) => getComputedStyle(document.getElementById(id) as Element).transitionDuration,
    ),
  );
  expect(durations).toEqual(['0s', '0s', '0s', '0s']);
});

test('200 percent zoom of a 480 px panel loses no text and does not scroll sideways', async () => {
  const panel = await readyPanel();
  await panel.click('#tools-toggle');
  await panel.setViewportSize({ width: 480, height: 800 });
  await panel.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  const report = await panel.evaluate(() => {
    const sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    // A text block is clipped when it hides part of its text (the title row cuts on purpose).
    const clipped = [
      ...document.querySelectorAll<HTMLElement>('button, label, h1, h2, p, li, code'),
    ]
      .filter(
        (el) =>
          el.offsetParent !== null &&
          !el.classList.contains('title-row') &&
          !el.classList.contains('visually-hidden'),
      )
      .filter(
        (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible',
      )
      .map((el) => el.id || el.tagName);
    return { sideways, clipped };
  });
  expect(report.sideways).toBeLessThanOrEqual(0);
  expect(report.clipped).toEqual([]);
});
