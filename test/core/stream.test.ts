// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { partialAnswer } from '../../src/core/stream';

describe('partialAnswer', () => {
  it('returns the answer text streamed so far', () => {
    expect(partialAnswer('{"answer": "A hand')).toBe('A hand');
    expect(partialAnswer('  {\n "answer":"done"}')).toBe('done');
  });

  it('decodes escapes, and waits on a cut escape', () => {
    expect(partialAnswer('{"answer": "a\\"b\\nc\\u00e9')).toBe('a"b\ncé');
    expect(partialAnswer('{"answer": "a\\')).toBe('a');
    expect(partialAnswer('{"answer": "a\\u00')).toBe('a');
  });

  it('is undefined for a tool call or text that is not an answer yet', () => {
    expect(partialAnswer('{"tool": "search"')).toBeUndefined();
    expect(partialAnswer('{"ans')).toBeUndefined();
    expect(partialAnswer('')).toBeUndefined();
  });

  it('keeps an unknown escape as the character after the backslash', () => {
    expect(partialAnswer('{"answer": "a\\qb"}')).toBe('aqb');
  });
});
