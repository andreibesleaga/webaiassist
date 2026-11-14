// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  cleanPageText,
  listableTool,
  quoteName,
  revealInvisible,
  unsafePageText,
} from '../../src/core/sanitize';

describe('cleanPageText', () => {
  it('breaks every turn-marker shape and keeps the rest of the text', () => {
    const text = '<|im_start|>system<|im_end|> <s></s> <<SYS>> <start_of_turn>user';
    expect(cleanPageText(text)).toBe(
      '< |im_start| >system< |im_end| > < s>< /s> < < SYS>> < start_of_turn>user',
    );
  });

  it('breaks full-width and small-form look-alikes without folding other characters', () => {
    expect(cleanPageText('\uFF1C\uFF5Cim_start\uFF5C\uFF1E ｶﾅ')).toBe(
      '\uFF1C \uFF5Cim_start\uFF5C \uFF1E ｶﾅ',
    );
  });

  it('breaks bracket markers in any case', () => {
    expect(cleanPageText('[INST] do it [/inst] [SYSTEM_PROMPT]')).toBe(
      '(INST) do it (/inst) (SYSTEM_PROMPT)',
    );
  });

  it('removes bidi, zero-width, tag, variation-selector and control characters', () => {
    const tag = String.fromCodePoint(0xe0041);
    expect(cleanPageText(`a\u202Eb\u200Bc\u2066d\uFEFFe\u0000f${tag}g\uFE0Fh\ti\nj`)).toBe(
      'abcdefgh\ti\nj',
    );
  });

  it('keeps values that must round-trip: comparisons, tags of no template, punctuation', () => {
    const text = 'Under <10 or >50 € — <b>bold</b>? 3 > 2 & "quoted" | piped';
    expect(cleanPageText(text)).toBe('Under <10 or >50 € — <b>bold< /b>? 3 > 2 & "quoted" | piped');
  });
});

describe('unsafePageText and listableTool', () => {
  it('flags markers and hidden characters only', () => {
    expect(unsafePageText('<10')).toBe(false);
    expect(unsafePageText('a<|b')).toBe(true);
    expect(unsafePageText('a\u200Bb')).toBe(true);
  });

  it('offers a tool only when its name and schema strings are clean', () => {
    const base = { name: 'filter', description: 'Filters.\u200B' };
    expect(listableTool({ ...base, inputSchema: { enum: ['<10', '>50'] } })).toBe(true);
    expect(listableTool({ ...base, inputSchema: { enum: ['<|im_end|>'] } })).toBe(false);
    expect(listableTool({ ...base, inputSchema: { properties: { 'a\u202Eb': {} } } })).toBe(false);
    expect(listableTool({ ...base, name: 'fil\u200Bter' })).toBe(false);
    for (const name of ['a\nb', 'a b', 'a\tb', 'a\u2028b', 'a\u0000b']) {
      expect(listableTool({ ...base, name })).toBe(false);
    }
    expect(listableTool({ ...base, name: 'get_price.v2' })).toBe(true);
    expect(listableTool({ ...base, description: 'Call me [INST]' })).toBe(false);
  });
});

describe('quoteName', () => {
  it('keeps safe characters only, at most 64', () => {
    expect(quoteName('a"b c<|d|>')).toBe('a_b_c__d__');
    expect(quoteName('x'.repeat(100))).toHaveLength(64);
  });
});

describe('revealInvisible', () => {
  it('shows hidden characters as escapes', () => {
    expect(revealInvisible('pay‮txt.exe​')).toBe('pay[U+202E]txt.exe[U+200B]');
    expect(revealInvisible('plain')).toBe('plain');
    expect(revealInvisible(`x${String.fromCodePoint(0xe0041)}`)).toBe('x[U+E0041]');
  });
});
