// SPDX-License-Identifier: Apache-2.0
// Colour contrast of both themes, computed from the tokens in static/ui.css with the WCAG 2.x
// formula: 4.5:1 for text, 3:1 for the outline of a control and for the focus ring. Every pair
// the stylesheet puts together is listed here, so a new colour pair is a new line in this list.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(process.cwd(), 'static/ui.css'), 'utf8');

type Tokens = Record<string, string>;

function declarations(block: string): Tokens {
  const out: Tokens = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out[match[1] as string] = match[2] as string;
  }
  return out;
}

/** The text between the braces that start at `open`. */
function braces(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && (depth -= 1) === 0) return source.slice(open + 1, i);
  }
  throw new Error('unbalanced braces in ui.css');
}

function themes(css: string): { light: Tokens; dark: Tokens } {
  const root = braces(css, css.indexOf(':root {') + ':root '.length);
  const mediaAt = css.indexOf('@media (prefers-color-scheme: dark)');
  const media = braces(css, css.indexOf('{', mediaAt));
  const light = declarations(root);
  return { light, dark: { ...light, ...declarations(media) } };
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** [foreground token, background token, what it is] for text that needs 4.5:1. */
const TEXT: readonly [string, string, string][] = [
  ['fg', 'bg', 'text on the page'],
  ['fg', 'surface', 'text on a card'],
  ['fg', 'accent-tint', 'your message'],
  ['muted', 'bg', 'muted text on the page'],
  ['muted', 'surface', 'muted text on a card'],
  ['accent', 'bg', 'link and tools button on the page'],
  ['accent', 'surface', 'tools button and Allow on a card'],
  ['on-accent', 'accent', 'text of a primary button'],
  ['accent', 'accent-tint', 'node badge, consent title'],
  ['ok', 'bg', 'reads mark and Allowed badge'],
  ['ok', 'surface', 'Allowed badge on a card'],
  ['danger', 'bg', 'Stop button'],
  ['danger', 'surface', 'Stop button on a card'],
  ['warn-fg', 'warn-bg', 'changes mark, blocked badge, warning, tool result'],
  ['info-fg', 'info-bg', 'page content mark, AI label, offline note'],
];

/** Outlines and rings that identify a control or show focus: 3:1 against what is around them. */
const SHAPES: readonly [string, string, string][] = [
  ['line-strong', 'bg', 'control border on the page'],
  ['line-strong', 'surface', 'control border on a card'],
  ['focus', 'bg', 'focus ring on the page'],
  ['focus', 'surface', 'focus ring on a card'],
  ['accent', 'bg', 'outline of a primary or Allow button'],
  ['danger', 'bg', 'outline of Stop'],
];

describe.each(['light', 'dark'] as const)('contrast, %s theme', (name) => {
  const colours = themes(CSS)[name];
  const value = (token: string): string => {
    const hex = colours[token];
    if (hex === undefined) throw new Error(`ui.css has no --${token} for the ${name} theme`);
    return hex;
  };

  it.each(TEXT)('%s on %s (%s) is at least 4.5:1', (fg, bg) => {
    expect(ratio(value(fg), value(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SHAPES)('%s against %s (%s) is at least 3:1', (fg, bg) => {
    expect(ratio(value(fg), value(bg))).toBeGreaterThanOrEqual(3);
  });
});

describe('the contrast check itself', () => {
  it('knows black on white is 21:1 and finds a weak pair', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#777777', '#888888')).toBeLessThan(1.5);
  });

  it('reads both themes from the stylesheet and only the dark one overrides', () => {
    const { light, dark } = themes(CSS);
    expect(light.bg).toBe('#ffffff');
    expect(dark.bg).toBe('#16181d');
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('matches the figures of the interface note (17.06 and 15.07 for the text)', () => {
    const { light, dark } = themes(CSS);
    expect(ratio(light.fg as string, light.bg as string)).toBeCloseTo(17.06, 1);
    expect(ratio(dark.fg as string, dark.bg as string)).toBeCloseTo(15.07, 1);
  });
});
