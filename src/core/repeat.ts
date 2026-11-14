// SPDX-License-Identifier: Apache-2.0
// The same tool call again: how to recognise it, what the model and the user are told, and
// the answer built from the results in hand when the model will not stop.
import { quoteName } from './sanitize';
import type { ToolArgs } from './types';

export const NOTE_AGAIN =
  'The assistant repeated a tool call it had already made. It was given the earlier result and asked to answer.';
export const NOTE_STOP =
  'The assistant repeated a tool call again and was stopped. The answer below is built from the tool results.';
/** The line the model reads after the earlier result is given again. */
export const NUDGE =
  'You already have this result (shown above). Do not call this tool with these arguments again. ' +
  'Answer the user now: {"answer": "<text>"}.';
/** What the saved chat keeps as the assistant's turn: no page text in a trusted role. */
export const STOPPED_REPLY = JSON.stringify({
  answer:
    'I stopped because I asked for the same tool call again. The tool results above are what I had.',
});

/** A call that already ran in this question: the tool and the page's result text. */
export interface MadeCall {
  readonly name: string;
  readonly text: string;
}

const RESULT_SHOWN = 1000;
const ANSWER_CAP = 3000;
const HEADER = 'What the tools returned:';

/** JSON with object keys in sorted order, so two spellings of one value are equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'null';
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
  return `{${entries.join(',')}}`;
}

/** The identity of a call: the tool name and its arguments, key order ignored. */
export function callKey(name: string, args: ToolArgs): string {
  return `${JSON.stringify(name)} ${canonical(args)}`;
}

function oneResult(call: MadeCall): string {
  const cut = call.text.length > RESULT_SHOWN;
  const text = cut ? `${call.text.slice(0, RESULT_SHOWN)} [cut]` : call.text;
  return `${quoteName(call.name)}: ${text}`;
}

/** An answer made only of the results: each under its tool name, capped in size. */
export function builtAnswer(calls: readonly MadeCall[]): string {
  const parts: string[] = [];
  let size = HEADER.length;
  for (const call of calls) {
    const part = oneResult(call);
    if (size + part.length > ANSWER_CAP) break;
    parts.push(part);
    size += part.length + 2;
  }
  const left = calls.length - parts.length;
  if (left > 0) parts.push(`[${left} more results not shown]`);
  return [HEADER, ...parts].join('\n\n');
}
