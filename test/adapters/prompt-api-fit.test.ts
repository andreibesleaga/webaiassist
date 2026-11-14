// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { RuntimeMessage } from '../../src/adapters/chat-messages';
import { shrinkTurns } from '../../src/adapters/prompt-api-fit';

const turn = (role: RuntimeMessage['role'], text: string): RuntimeMessage => ({
  role,
  content: `${text} ${'word '.repeat(100)}`,
});
const chat = [
  turn('system', 'S'),
  turn('user', 'u1'),
  turn('assistant', 'a1'),
  turn('user', 'u2'),
  turn('assistant', 'a2'),
  turn('user', 'u3'),
];

describe('shrinkTurns', () => {
  it('removes the oldest turns first and keeps the system turn', () => {
    const smaller = shrinkTurns(chat, 600, 1200) ?? [];
    expect(smaller[0]?.role).toBe('system');
    expect(smaller.at(-1)).toEqual(chat.at(-1));
    expect(smaller.length).toBeLessThan(chat.length);
    expect(smaller.some((m) => m.content.startsWith('u1'))).toBe(false);
  });

  it('always removes at least one turn, and starts the kept turns on a user turn', () => {
    const smaller = shrinkTurns(chat, 1000, 1000) ?? [];
    expect(smaller.length).toBeLessThan(chat.length);
    expect(smaller[1]?.role).toBe('user');
  });

  it('can drop every earlier turn', () => {
    expect(shrinkTurns(chat, 1, 100000)).toEqual([chat[0]]);
  });

  it('has nothing to do when only a system turn is there', () => {
    expect(shrinkTurns([turn('system', 'S')], 1, 2)).toBeUndefined();
    expect(shrinkTurns([], 1, 2)).toBeUndefined();
  });
});
