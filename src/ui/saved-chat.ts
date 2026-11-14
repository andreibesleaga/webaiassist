// SPDX-License-Identifier: Apache-2.0
// The saved chat of a site, as transcript lines: what the user asked and what the assistant
// answered. Tool results and the loop's own prompts are not shown again (they stay saved for
// the model). The assistant's turns are JSON actions; only an answer becomes a line.
import { REPAIR } from '../core/check-action';
import type { TranscriptEntry } from '../core/export';
import { NUDGE } from '../core/repeat';
import type { ChatMessage } from '../core/types';

const REPAIR_START = REPAIR.split('%s')[0] ?? REPAIR;

function answerOf(content: string): string | undefined {
  try {
    const value = JSON.parse(content) as { answer?: unknown };
    return typeof value.answer === 'string' ? value.answer : undefined;
  } catch {
    return undefined;
  }
}

function entryOf(message: ChatMessage): TranscriptEntry | undefined {
  if (message.role === 'assistant') {
    const text = answerOf(message.content);
    return text === undefined ? undefined : { kind: 'answer', text };
  }
  if (message.role !== 'user') return undefined;
  const internal = message.content === NUDGE || message.content.startsWith(REPAIR_START);
  return internal ? undefined : { kind: 'user', text: message.content };
}

export function savedEntries(messages: readonly ChatMessage[]): TranscriptEntry[] {
  return messages.map(entryOf).filter((entry): entry is TranscriptEntry => entry !== undefined);
}
