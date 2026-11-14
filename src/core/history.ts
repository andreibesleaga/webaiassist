// SPDX-License-Identifier: Apache-2.0
// Keeps each request of a run inside the model's context window. Tokens are estimated: a
// Latin-script character is about a third of a token, any other character (CJK, Cyrillic,
// emoji ...) counts as a whole one, plus a few tokens per message. The site's saved chat is
// cut first, oldest turns first, so that the request, the reply and one more tool result as
// large as the largest one of this run still fit.
import type { ChatMessage } from './types';

const LATIN_CHARS_PER_TOKEN = 3;
const TOKENS_PER_MESSAGE = 4;
/** The last code point counted as Latin script (Basic Latin to Latin Extended-B, IPA). */
const LAST_LATIN = 0x2af;
/** Room left for the model's reply. */
export const REPLY_RESERVE_TOKENS = 512;
/**
 * The window as `fitToContext` should see it: the runtime's own reply size, when it has one,
 * replaces the default reserve (`fitToContext` always subtracts the default).
 */
export function usableContext(capabilities: {
  readonly contextTokens: number;
  readonly replyTokens?: number;
}): number {
  const extra = (capabilities.replyTokens ?? REPLY_RESERVE_TOKENS) - REPLY_RESERVE_TOKENS;
  return capabilities.contextTokens - extra;
}

/** A hard cap that also holds for very large context windows (the model host takes 500). */
export const MAX_HISTORY_MESSAGES = 200;

/** An approximate token count of one message. */
export function estimateTokens(text: string): number {
  let latin = 0;
  let other = 0;
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) <= LAST_LATIN) latin += 1;
    else other += 1;
  }
  return Math.ceil(latin / LATIN_CHARS_PER_TOKEN) + other + TOKENS_PER_MESSAGE;
}

const total = (messages: readonly ChatMessage[]): number =>
  messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);

/** The newest messages, at most MAX_HISTORY_MESSAGES, system messages dropped. */
export function recentHistory(history: readonly ChatMessage[]): ChatMessage[] {
  return startOnUser(history.filter((m) => m.role !== 'system').slice(-MAX_HISTORY_MESSAGES));
}

function startOnUser(messages: ChatMessage[]): ChatMessage[] {
  while (messages.length > 0 && messages[0]?.role !== 'user') messages.shift();
  return messages;
}

/** Where the saved chat sits in a run's messages: indexes 1 to `count` (after the system). */
export interface HistorySpan {
  count: number;
}

/**
 * Removes the oldest saved-chat messages from `messages` (in place) until the request, the
 * reply reserve and `resultReserve` fit in `contextTokens`; the kept chat starts on a user turn.
 * What the run itself added is never removed.
 */
export function fitToContext(
  messages: ChatMessage[],
  span: HistorySpan,
  contextTokens: number,
  resultReserve: number,
): void {
  const room = contextTokens - REPLY_RESERVE_TOKENS - resultReserve;
  while (span.count > 0 && (total(messages) > room || messages[1]?.role !== 'user')) {
    messages.splice(1, 1);
    span.count -= 1;
  }
}
