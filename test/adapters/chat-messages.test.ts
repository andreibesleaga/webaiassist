// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { collectStream, toRuntimeMessages } from '../../src/adapters/chat-messages';
import { items } from './runtime-helpers';

describe('toRuntimeMessages', () => {
  it('sends tool results as user turns, since the runtimes know no tool role', () => {
    expect(
      toRuntimeMessages([
        { role: 'system', content: 'S' },
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: '{"tool":"x"}' },
        { role: 'tool', content: '<tool-result>' },
      ]),
    ).toEqual([
      { role: 'system', content: 'S' },
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: '{"tool":"x"}' },
      { role: 'user', content: '<tool-result>' },
    ]);
  });

  it('joins two turns of the same role so the roles alternate', () => {
    expect(
      toRuntimeMessages([
        { role: 'user', content: 'a' },
        { role: 'tool', content: 'b' },
      ]),
    ).toEqual([{ role: 'user', content: 'a\n\nb' }]);
  });
});

describe('collectStream', () => {
  it('passes each piece to onToken and returns the whole text', async () => {
    const seen: string[] = [];
    const text = await collectStream(items(['Hel', 'lo']), (t) => seen.push(t));
    expect(text).toBe('Hello');
    expect(seen).toEqual(['Hel', 'lo']);
  });

  it('skips empty pieces', async () => {
    const seen: string[] = [];
    expect(await collectStream(items(['', 'a']), (t) => seen.push(t))).toBe('a');
    expect(seen).toEqual(['a']);
  });
});
