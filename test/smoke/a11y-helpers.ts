// SPDX-License-Identifier: Apache-2.0
// Accessibility helpers shared by the smoke tests (a11y.spec.ts) and the BDD steps: an
// axe-core run with the WCAG 2.2 A and AA rules, the focus ring check and the Tab walk.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AXE = readFileSync(join(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Waits (at most 3 seconds) until no CSS transition or finite animation is running: a colour
 *  measured in the middle of a change (after a theme switch) is not the colour a person ends
 *  up with. An animation that never ends (a spinner) is left alone. */
async function settleAnimations(page: Page): Promise<void> {
  const quiet = (): boolean =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().endTime === Infinity,
      );
  await page.waitForFunction(quiet, undefined, { timeout: 3_000, polling: 25 }).catch(() => null);
}

/** axe violations as "rule: targets"; page.evaluate is not bound by the page CSP. */
export async function axe(page: Page): Promise<string[]> {
  await settleAnimations(page);
  await page.evaluate(AXE);
  return page.evaluate(async (tags) => {
    type Result = { violations: { id: string; nodes: { target: string[] }[] }[] };
    type Axe = { run(context: Document, options: object): Promise<Result> };
    const result = await (globalThis as unknown as { axe: Axe }).axe.run(document, {
      runOnly: { type: 'tag', values: tags },
    });
    return result.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
  }, TAGS);
}

/** True when the focused element shows the 3 px focus outline. */
export const focusVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
  });

/** Ids of the elements Tab reaches, in order from the top, and whether each showed focus. */
export async function tabOrder(
  page: Page,
  presses: number,
): Promise<{ ids: string[]; shown: boolean[] }> {
  await page.bringToFront();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const ids: string[] = [];
  const shown: boolean[] = [];
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press('Tab');
    ids.push(await page.evaluate(() => document.activeElement?.id ?? ''));
    shown.push(await focusVisible(page));
  }
  return { ids, shown };
}

/** What the graphics-card list of Options holds: "Automatic" and the five models. None of them
 *  needs a feature that only some graphics cards have, so the count is the same in every browser. */
export function webllmOptionCount(): number {
  return 6;
}
