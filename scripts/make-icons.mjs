// SPDX-License-Identifier: Apache-2.0
// Renders the icon to the PNG sizes the manifest and the Chrome Web Store use (16, 32, 48, 128),
// with the Chromium that Playwright installs. Two drawings: static/icons/icon.svg (a chat bubble
// that says "www") for 48 and 128, and icon-small.svg (the same bubble with one "w") for 16 and
// 32, where three letters would blur. Run after changing an SVG: npm run icons. The PNGs are
// kept in the repository; the build only copies them.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ICON_SIZES = [16, 32, 48, 128];
const dir = fileURLToPath(new URL('../static/icons/', import.meta.url));
/** Sizes up to this one use the one-letter drawing. */
export const SMALL_UP_TO = 32;
const drawing = (size) =>
  readFileSync(`${dir}${size <= SMALL_UP_TO ? 'icon-small.svg' : 'icon.svg'}`, 'utf8');

const browser = await chromium.launch();
try {
  for (const size of ICON_SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const html = `<body style="margin:0">${drawing(size).replace('width="128" height="128"', `width="${size}" height="${size}"`)}</body>`;
    await page.setContent(html);
    await page.screenshot({ path: `${dir}icon-${size}.png`, omitBackground: true });
    await page.close();
  }
  console.log(`icons written: ${ICON_SIZES.map((s) => `icon-${s}.png`).join(', ')}`);
} finally {
  await browser.close();
}
