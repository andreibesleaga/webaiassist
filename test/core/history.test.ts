// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  estimateTokens,
  fitToContext,
  MAX_HISTORY_MESSAGES,
  recentHistory,
  REPLY_RESERVE_TOKENS,
} from '../../src/core/history';
import type { ChatMessage } from '../../src/core/types';

const turns = (count: number, content = 'turn'): ChatMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `${content} ${i}`,
  }));

describe('estimateTokens', () => {
  it('counts about three Latin characters per token plus a few per message', () => {
    expect(estimateTokens('')).toBe(4);
    expect(estimateTokens('abcdef')).toBe(6);
  });

  it('counts every CJK or other non-Latin character as a whole token', () => {
    expect(estimateTokens('日本語のテキスト')).toBe(8 + 4);
    expect(estimateTokens('привет')).toBe(6 + 4);
  });
});

describe('recentHistory', () => {
  it('drops system messages, keeps the newest, starts on a user turn', () => {
    const history: ChatMessage[] = [{ role: 'system', content: 'old rules' }, ...turns(3)];
    expect(recentHistory(history).map((m) => m.content)).toEqual(['turn 0', 'turn 1', 'turn 2']);
    expect(recentHistory(turns(1000))).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(recentHistory(turns(1000))[0]?.role).toBe('user');
  });
});

describe('fitToContext', () => {
  const system: ChatMessage = { role: 'system', content: 's' };
  const question: ChatMessage = { role: 'user', content: 'q' };
  const run = (history: ChatMessage[]) => [system, ...history, question];

  it('removes the oldest saved turns until the request and the reserves fit', () => {
    const messages = run(turns(10));
    const span = { count: 10 };
    const fixed = estimateTokens('s') + estimateTokens('q');
    const context = REPLY_RESERVE_TOKENS + 100 + fixed + 4 * estimateTokens('turn 0');
    fitToContext(messages, span, context, 100);
    expect(messages.map((m) => m.content)).toEqual([
      's',
      'turn 6',
      'turn 7',
      'turn 8',
      'turn 9',
      'q',
    ]);
    expect(span.count).toBe(4);
  });

  it('never starts the kept chat on an answer, and never removes what the run added', () => {
    const messages = run(turns(10));
    const span = { count: 10 };
    const fixed = estimateTokens('s') + estimateTokens('q');
    fitToContext(messages, span, REPLY_RESERVE_TOKENS + fixed + 3 * estimateTokens('turn 0'), 0);
    expect(messages.map((m) => m.content)).toEqual(['s', 'turn 8', 'turn 9', 'q']);
    fitToContext(messages, span, 1, 0);
    expect(messages.map((m) => m.content)).toEqual(['s', 'q']);
    expect(span.count).toBe(0);
  });
});
