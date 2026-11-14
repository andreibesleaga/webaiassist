// SPDX-License-Identifier: Apache-2.0
// Reads the one action a model reply asks for: a tool call or a final answer.
import type { JsonSchema, ToolArgs } from './types';

export type Action =
  | { readonly kind: 'answer'; readonly text: string }
  | { readonly kind: 'call'; readonly tool: string; readonly args: ToolArgs };

export type ParseResult =
  { readonly ok: true; readonly action: Action } | { readonly ok: false; readonly reason: string };

const ANSWER_BRANCH: JsonSchema = {
  type: 'object',
  required: ['answer'],
  properties: { answer: { type: 'string' } },
  additionalProperties: false,
};

const toolBranch = (names?: readonly string[]): JsonSchema => ({
  type: 'object',
  required: ['tool'],
  properties: {
    tool: names ? { type: 'string', enum: [...names] } : { type: 'string' },
    arguments: { type: 'object' },
  },
  additionalProperties: false,
});

/**
 * The reply shape for runtimes that can constrain output to a schema: one answer, or one call
 * of a tool in `names`. With no tool to name, only an answer is allowed. The arguments of a
 * call are checked later against the tool's own schema.
 */
export function actionSchema(names?: readonly string[]): JsonSchema {
  const branches = names?.length === 0 ? [ANSWER_BRANCH] : [ANSWER_BRANCH, toolBranch(names)];
  return { type: 'object', oneOf: branches };
}

/** The reply shape for any tool name (what a page may call is checked after the reply). */
export const ACTION_SCHEMA: JsonSchema = actionSchema();

const fail = (reason: string): ParseResult => ({ ok: false, reason });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The text from the first "{" to the last "}", so fences and chatter around it are ignored. */
function jsonSlice(reply: string): string | undefined {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  return start === -1 || end <= start ? undefined : reply.slice(start, end + 1);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toAction(value: Record<string, unknown>): ParseResult {
  if (typeof value.answer === 'string') {
    return { ok: true, action: { kind: 'answer', text: value.answer } };
  }
  if (typeof value.tool !== 'string') return fail('the JSON has neither "answer" nor "tool"');
  const args = value.arguments ?? {};
  if (!isObject(args)) return fail('"arguments" must be a JSON object');
  return { ok: true, action: { kind: 'call', tool: value.tool, args } };
}

export function parseAction(reply: string): ParseResult {
  const slice = jsonSlice(reply);
  if (slice === undefined) return fail('no JSON object in the reply');
  const value = parseJson(slice);
  // A slice from "{" to "}" that parses is always an object.
  if (!isObject(value)) return fail('the reply is not valid JSON');
  return toAction(value);
}
