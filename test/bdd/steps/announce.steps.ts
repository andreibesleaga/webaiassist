// SPDX-License-Identifier: Apache-2.0
// Steps of what a screen reader hears and of motion and zoom (feature 16): the alert banner,
// download progress announced every ten percent, a draft kept out of the log, reduced motion and
// 200 percent zoom.
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures';
import { chooseCpu, startAndAgree } from './setup.steps';
import { askAndSettle, ensureSite, scriptedReady } from './site-helpers';

// ---- what a screen reader hears ----------------------------------------------------------------------

Given('an error is shown in the banner', async ({ world }) => {
  await ensureSite(world);
  const panel = world.requirePanel();
  await scriptedReady(world);
  await panel.fill('#question', '/fail the model crashed');
  await panel.press('#question', 'Control+Enter');
  await expect(panel.locator('#error-banner')).toBeVisible();
});

Then('the banner has the role alert', async ({ world }) => {
  await expect(world.requirePanel().locator('#error-banner')).toHaveAttribute('role', 'alert');
});

Then('the progress announcement changes only every ten percent', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu');
  const panel = world.requirePanel();
  await startAndAgree(panel);
  await expect(panel.locator('#model-status')).toContainText('Ready: ', { timeout: 30_000 });
  const lines = await panel.evaluate(
    () => (window as unknown as { __modelLines: string[] }).__modelLines,
  );
  const tenths = lines
    .filter((line) => line.startsWith('Downloading') && /\(\d+%\)/.test(line))
    .map((line) => Math.floor(Number(/\((\d+)%\)/.exec(line)?.[1]) / 10));
  expect(tenths.length).toBeGreaterThan(1);
  // One line for each tenth at most, in rising order: never two announcements for one tenth.
  expect(tenths).toEqual([...new Set(tenths)].sort((a, b) => a - b));
  // And the bar itself moved more often than the line.
  await expect(panel.locator('#progress')).toHaveAttribute('max', '1');
});

Given('an answer is streaming', async ({ world }) => {
  await ensureSite(world);
  await scriptedReady(world);
  await askAndSettle(world, 'Hello');
});

Then('the draft is hidden from assistive technology', async ({ world }) => {
  const draft = world.requirePanel().locator('#draft');
  await expect(draft).toHaveAttribute('aria-hidden', 'true');
  expect(await draft.evaluate((el) => el.closest('[role="log"]') === null)).toBe(true);
});

Then('the finished answer enters the log once', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('[role="log"] #transcript li.assistant')).toHaveCount(1);
  await expect(panel.locator('#draft')).toHaveText('');
});

// ---- reduced motion and zoom ----------------------------------------------------------------------------

Given('the browser prefers reduced motion', async ({ world }) => {
  await ensureSite(world);
  await world.requirePanel().emulateMedia({ reducedMotion: 'reduce' });
});

Then('no animation or transition runs', async ({ world }) => {
  const moving = await world.requirePanel().evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const style = getComputedStyle(el);
        return style.animationName !== 'none' || parseFloat(style.transitionDuration) > 0;
      })
      .map((el) => el.id || el.tagName),
  );
  expect(moving).toEqual([]);
});

When('the text is zoomed to 200 percent', async ({ world }) => {
  const panel = world.requirePanel();
  await panel.setViewportSize({ width: 480, height: 800 });
  await panel.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
});

Then('no text is clipped', async ({ world }) => {
  const report = await world.requirePanel().evaluate(() => ({
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped: [...document.querySelectorAll<HTMLElement>('button, label, h1, h2, p, li, code')]
      .filter((el) => el.offsetParent !== null)
      .filter(
        (el) => !el.classList.contains('title-row') && !el.classList.contains('visually-hidden'),
      )
      .filter(
        (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible',
      )
      .map((el) => el.id || el.tagName),
  }));
  expect(report.sideways).toBeLessThanOrEqual(0);
  expect(report.clipped).toEqual([]);
});
