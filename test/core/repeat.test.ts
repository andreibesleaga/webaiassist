// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { builtAnswer, callKey } from '../../src/core/repeat';

describe('callKey: the same tool with the same arguments, whatever the key order', () => {
  it('is equal for reordered keys at any depth', () => {
    const a = callKey('read', { slug: 'a', opts: { x: 1, y: [1, { p: 1, q: 2 }] } });
    const b = callKey('read', { opts: { y: [1, { q: 2, p: 1 }], x: 1 }, slug: 'a' });
    expect(a).toBe(b);
  });

  it('differs for another tool, another value or another array order', () => {
    const base = callKey('read', { slug: 'a' });
    expect(callKey('search', { slug: 'a' })).not.toBe(base);
    expect(callKey('read', { slug: 'b' })).not.toBe(base);
    expect(callKey('t', { l: [1, 2] })).not.toBe(callKey('t', { l: [2, 1] }));
    expect(callKey('t', { n: 1 })).not.toBe(callKey('t', { n: '1' }));
  });
});

describe('builtAnswer: an answer made only of the results in hand', () => {
  it('lists each result under its tool name, in the order they came', () => {
    const text = builtAnswer([
      { name: 'search', text: 'two hits' },
      { name: 'read', text: 'the page body' },
    ]);
    expect(text).toBe('What the tools returned:\n\nsearch: two hits\n\nread: the page body');
  });

  it('cuts a long result and the total, and says so', () => {
    const long = 'x'.repeat(5000);
    const text = builtAnswer([{ name: 'a', text: long }]);
    expect(text.length).toBeLessThan(1500);
    expect(text).toContain('[cut]');
    const many = builtAnswer(
      Array.from({ length: 20 }, (_, i) => ({ name: `t${i}`, text: 'y'.repeat(900) })),
    );
    expect(many.length).toBeLessThan(3200);
    expect(many).toContain('more results not shown');
  });
});
