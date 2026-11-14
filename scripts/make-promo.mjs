// SPDX-License-Identifier: Apache-2.0
// Renders the listing graphics that are not screenshots into docs/store/: the small promo tile
// (440 x 280) and the marquee tile (1400 x 560) of the Chrome Web Store, and a link-preview
// card (1200 x 630) for the site page and posts. Each is the icon, the name and one sentence on
// the interface's blue; no photo, no screenshot, no claim. Run: npm run promo. The PNGs are kept
// in the repository and are not part of the extension package.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const icon = readFileSync(`${root}static/icons/icon.svg`, 'utf8');
export const NAME = 'WebAIAssist';
export const LINE = 'A local AI model in your side panel that uses the tools of the open page.';
export const PROMO = [
  { file: 'promo-small-440x280.png', width: 440, height: 280, icon: 96, name: 34, line: 15 },
  { file: 'promo-marquee-1400x560.png', width: 1400, height: 560, icon: 220, name: 92, line: 32 },
  { file: 'social-card-1200x630.png', width: 1200, height: 630, icon: 210, name: 84, line: 30 },
];

/** The white bubble with the blue letters, without the blue square (the page is the square). */
const mark = (size) =>
  icon
    .replace('width="128" height="128"', `width="${size}" height="${size}"`)
    .replace('viewBox="0 0 128 128"', 'viewBox="20 30 88 76"')
    .replace(/<rect[^>]*\/>/, '');

function page({ width, height, icon: size, name, line }) {
  const gap = Math.round(size / 5);
  return `<body style="margin:0;width:${width}px;height:${height}px;background:#0b57d0;color:#fff;
    font-family:system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;
    align-items:center;justify-content:center;gap:${gap}px;box-sizing:border-box;padding:0 ${gap}px">
    ${mark(size)}
    <div style="max-width:${Math.round(width * 0.58)}px">
      <div style="font-size:${name}px;font-weight:700;letter-spacing:-0.01em;line-height:1.1">${NAME}</div>
      <div style="font-size:${line}px;line-height:1.35;margin-top:${Math.round(line / 2)}px">${LINE}</div>
    </div></body>`;
}

const out = `${root}docs/store/`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const item of PROMO) {
    const tab = await browser.newPage({ viewport: { width: item.width, height: item.height } });
    await tab.setContent(page(item));
    await tab.screenshot({ path: `${out}${item.file}` });
    await tab.close();
  }
  console.log(`written to docs/store/: ${PROMO.map((p) => p.file).join(', ')}`);
} finally {
  await browser.close();
}
