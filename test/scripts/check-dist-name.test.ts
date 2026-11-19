// SPDX-License-Identifier: Apache-2.0
// The store title of the package: the manifest `name` starts with the product name, has at most
// 75 characters (Chrome's limit), and a longer title keeps "WebAIAssist" as its short name.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkManifest } from '../../scripts/check-dist.mjs';

const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8')) as Record<
  string,
  unknown
>;
const exists = (): boolean => true;
const NAME_RULE =
  'name must be "WebAIAssist" or start with "WebAIAssist - ", at most 75 characters';
const SHORT_RULE = 'short_name must be "WebAIAssist" when the name is longer';

describe('the store title in the manifest', () => {
  it('is the product name, a hyphen and a line on what it is, with the short name beside it', () => {
    expect(manifest.name).toBe(
      'WebAIAssist - Browser AI for WebMCP websites and the agentic knowledge web',
    );
    expect(String(manifest.name).length).toBeLessThanOrEqual(75);
    expect(manifest.short_name).toBe('WebAIAssist');
    expect(checkManifest(manifest, exists)).toEqual([]);
  });

  it('may be the product name alone', () => {
    const { short_name: _short, ...rest } = manifest;
    expect(checkManifest({ ...rest, name: 'WebAIAssist' }, exists)).toEqual([]);
  });

  it('needs the short name when it is longer than the product name', () => {
    const { short_name: _short, ...rest } = manifest;
    expect(checkManifest(rest, exists)).toEqual([SHORT_RULE]);
    expect(checkManifest({ ...manifest, short_name: 'Assist' }, exists)).toEqual([SHORT_RULE]);
  });

  it('is refused over 75 characters, or when the product name does not come first', () => {
    const long = `${String(manifest.name)} and more`;
    expect(long.length).toBeGreaterThan(75);
    expect(checkManifest({ ...manifest, name: long }, exists)).toEqual([NAME_RULE]);
    expect(checkManifest({ ...manifest, name: 'AI for WebMCP - WebAIAssist' }, exists)).toEqual([
      NAME_RULE,
    ]);
    expect(checkManifest({ ...manifest, name: 'WebAIAssistant' }, exists)).toEqual([NAME_RULE]);
  });
});
