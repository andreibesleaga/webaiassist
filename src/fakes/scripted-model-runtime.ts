// SPDX-License-Identifier: Apache-2.0
// A model with a fixed script, for the Playwright smoke test of the built extension. It is
// in the model list only in the smoke-test build (npm run build:smoke).
//   /tool name {json}    one tool call; after a tool result it answers with that result's text;
//                        when asked to repair its reply it sends the same call again
//   /loop name {json}    a tool call at every step, each with a new "step" argument
//   /repeat name {json}  the same tool call at every step, whatever it is told
//   /fail text           the model itself fails with that text
//   /lost                the model fails as a lost graphics device does
// Any other text is echoed.
import { REPAIR } from '../core/check-action';
import { NUDGE } from '../core/repeat';
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
} from '../core/ports/model-runtime';
import type { ChatMessage } from '../core/types';

const COMMAND = /^\/(tool|loop|repeat)\s+(\S+)\s*(\{[\s\S]*\})?\s*$/;
const FENCE = /^<tool-result[^>]*>\n([\s\S]*)\n<\/tool-result>$/;
const REPAIR_START = REPAIR.slice(0, REPAIR.indexOf('%s'));

/** The user's question: the last user turn that the loop did not write itself. */
function questionIndex(messages: readonly ChatMessage[]): number {
  return messages.findLastIndex(
    (m) => m.role === 'user' && !m.content.startsWith(REPAIR_START) && m.content !== NUDGE,
  );
}

function toolCall(name: string, json: string | undefined, extra: object = {}): object {
  return { tool: name, arguments: { ...(JSON.parse(json ?? '{}') as object), ...extra } };
}

/** The reply to a "/loop" or "/repeat" question, which never answers. */
function neverAnswers(command: RegExpExecArray, after: readonly ChatMessage[]): object {
  const [, kind, name = '', json] = command;
  if (kind === 'repeat') return toolCall(name, json);
  return toolCall(name, json, { step: after.filter((m) => m.role === 'tool').length });
}

/** The reply to "/tool": the call, or after its result an answer with the result's text. */
function oneTool(command: RegExpExecArray, after: readonly ChatMessage[]): object {
  const last = after.at(-1);
  if (last?.role !== 'tool') return toolCall(command[2] ?? '', command[3]);
  return { answer: `The tool said: ${FENCE.exec(last.content)?.[1] ?? last.content}` };
}

function reply(request: ChatRequest): object {
  const at = questionIndex(request.messages);
  const question = request.messages[at]?.content ?? '';
  const command = COMMAND.exec(question);
  if (!command) return { answer: `Scripted reply to: ${question}` };
  const after = request.messages.slice(at + 1);
  return command[1] === 'tool' ? oneTool(command, after) : neverAnswers(command, after);
}

const LOST = 'Object has already been disposed (DXGI_ERROR_DEVICE_REMOVED)';

/** "/fail text" and "/lost": the failures of a real model, for the scenarios about errors. */
function failureOf(request: ChatRequest): Error | undefined {
  const question = request.messages[questionIndex(request.messages)]?.content ?? '';
  if (question.trim() === '/lost') return new Error(LOST);
  const fail = /^\/fail\s+([\s\S]+)$/.exec(question);
  return fail ? new Error(fail[1]) : undefined;
}

/** A test that sets `globalThis.__scriptedRequests = []` in the panel can read what the model was sent. */
function recordRequest(request: ChatRequest): void {
  const log = (globalThis as { __scriptedRequests?: unknown[] }).__scriptedRequests;
  log?.push(request.messages.map((m) => ({ role: m.role, content: m.content })));
}

export class ScriptedModelRuntime implements ModelRuntime {
  load(modelId: string, onProgress: (progress: LoadProgress) => void): Promise<void> {
    onProgress({ fraction: 1, text: `loaded ${modelId}` });
    return Promise.resolve();
  }

  chat(request: ChatRequest): Promise<string> {
    recordRequest(request);
    const failure = failureOf(request);
    if (failure) return Promise.reject(failure);
    const text = JSON.stringify(reply(request));
    request.onToken?.(text);
    return Promise.resolve(text);
  }

  unload(): Promise<void> {
    return Promise.resolve();
  }

  capabilities(): ModelCapabilities {
    return { nativeToolCalls: false, jsonConstraint: false, contextTokens: 4096 };
  }
}
