// SPDX-License-Identifier: Apache-2.0
// Shared by the model runtime adapters: the message list a runtime accepts, and the
// streaming loop. Neither the local engine's chat templates as used here nor Chrome's Prompt
// API has a tool role, so tool results go in as user turns; they are already fenced as untrusted.
import type { ChatMessage } from '../core/types';

export interface RuntimeMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export function toRuntimeMessages(messages: readonly ChatMessage[]): RuntimeMessage[] {
  const out: RuntimeMessage[] = [];
  for (const message of messages) {
    const role = message.role === 'tool' ? 'user' : message.role;
    const last = out.at(-1);
    if (last?.role === role) {
      out[out.length - 1] = { role, content: `${last.content}\n\n${message.content}` };
    } else {
      out.push({ role, content: message.content });
    }
  }
  return out;
}

/** Reads every piece of a stream, hands each non-empty piece on, returns the whole text. */
export async function collectStream(
  pieces: AsyncIterable<string>,
  onToken?: (token: string) => void,
): Promise<string> {
  let text = '';
  for await (const piece of pieces) {
    if (piece === '') continue;
    text += piece;
    onToken?.(piece);
  }
  return text;
}

/** The core passes a CancelSignal; a real AbortSignal also has addEventListener. */
export function asAbortSignal(signal: unknown): AbortSignal | undefined {
  if (typeof signal !== 'object' || signal === null) return undefined;
  return 'addEventListener' in signal ? (signal as AbortSignal) : undefined;
}
