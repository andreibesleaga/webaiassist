// SPDX-License-Identifier: Apache-2.0
// The agent loop: plan, call a tool through the confirmation gate, observe, answer.
// A pure function of what the ports return; it imports no browser API. A run is bound to
// the tab and the site (origin) it started on: when the tab leaves that site, it ends.
import { actionSchema } from './action';
import { checkAction, REPAIR, type Checked } from './check-action';
import { compactBudget, buildCompactPrompt } from './compact-prompt';
import { estimateTokens, fitToContext, recentHistory, usableContext } from './history';
import type { ChatUI } from './ports/chat-ui';
import { buildMessages, buildSystemPrompt } from './prompt';
import {
  builtAnswer,
  callKey,
  NOTE_AGAIN,
  NOTE_STOP,
  NUDGE,
  STOPPED_REPLY,
  type MadeCall,
} from './repeat';
import { cleanPageText, listableTool } from './sanitize';
import { partialAnswer } from './stream';
import { listOnSite, runTool, type AgentDeps, type LoopState, type RunScope } from './tool-step';
import type { ToolStat } from './ports/memory';
import type { ChatMessage, ToolInfo } from './types';
import { AFTER_RESULT, SITE_BACKGROUND } from './tool-rules';
import { PAGE_TEXT_TOOL, fenceSavedResult, wrapUntrusted } from './untrusted';

export type { AgentDeps } from './tool-step';

export const DEFAULT_MAX_STEPS = 6;

export interface AgentInput extends RunScope {
  readonly userText: string;
  readonly history?: readonly ChatMessage[];
  readonly maxSteps?: number;
  /** The page is an AgenticSystemCore node (see node-mode.ts). */
  readonly node?: boolean;
  /** Text of the page the user asked to read; given to the model as untrusted data. */
  readonly pageText?: string;
  /** Short facts from the files the site published, already fenced as untrusted data
   *  (site-context.ts). Used for this question only and never saved with the chat. */
  readonly siteContext?: string;
}

export type AgentStatus = 'answered' | 'step-cap' | 'stopped' | 'failed';

export interface AgentResult {
  readonly status: AgentStatus;
  readonly answer?: string;
  readonly error?: string;
  readonly steps: number;
  readonly messages: readonly ChatMessage[];
}

export async function runAgent(deps: AgentDeps, input: AgentInput): Promise<AgentResult> {
  const state = await startState(deps, input);
  const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;
  while (state.steps < maxSteps && state.movedTo === undefined) {
    if (input.signal?.aborted === true) return finish(deps, input, state, { status: 'stopped' });
    const outcome = await step(deps, input, state);
    if (outcome) return outcome;
  }
  if (state.movedTo !== undefined) return siteChanged(deps, input, state, state.movedTo);
  const error = `The assistant stopped after ${maxSteps} tool steps (the limit in Options).`;
  deps.ui.show({ kind: 'error', text: error });
  return finish(deps, input, state, { status: 'step-cap', error });
}

async function startState(deps: AgentDeps, input: AgentInput): Promise<LoopState> {
  const state: LoopState = {
    messages: [],
    tools: [],
    steps: 0,
    repairUsed: false,
    denied: new Set(),
    made: new Map(),
    repeats: 0,
    history: { count: 0 },
    largestResult: 0,
    transient: new Set(),
  };
  const listing = await listOnSite(deps, input, state);
  state.tools = listing?.tools ?? [];
  const stats = await deps.memory.history(input.origin);
  const system = systemPrompt(deps, input, state.tools, stats);
  const history = recentHistory(input.history ?? []).map(fenceSaved);
  state.history.count = history.length;
  state.messages.push(...buildMessages(system, history, input.userText));
  if (input.pageText !== undefined) {
    const page = wrapUntrusted(PAGE_TEXT_TOOL, input.pageText);
    state.messages.splice(-1, 0, { role: 'tool', content: page });
  }
  if (input.siteContext !== undefined) {
    const facts: ChatMessage = {
      role: 'tool',
      content: `${SITE_BACKGROUND}\n${input.siteContext}`,
    };
    state.messages.splice(-1, 0, facts);
    state.transient.add(facts);
  }
  return state;
}

/** The full rules and tool list, or the compact ones when the runtime has a small window. */
function systemPrompt(
  deps: AgentDeps,
  input: AgentInput,
  tools: readonly ToolInfo[],
  stats: readonly ToolStat[],
): string {
  const node = input.node === true;
  const caps = deps.model.capabilities();
  if (caps.compactPrompt !== true) return buildSystemPrompt(tools, stats, { node });
  const budgetTokens = compactBudget(caps.contextTokens);
  return buildCompactPrompt(tools, { budgetTokens, question: input.userText, node });
}

/** Trims the saved chat so this request fits, with room for the reply and one more result. */
function fit(deps: AgentDeps, state: LoopState): void {
  const context = usableContext(deps.model.capabilities());
  fitToContext(state.messages, state.history, context, state.largestResult);
}

/** A tool result from the saved chat is data from a page: it is fenced again if need be. */
function fenceSaved(message: ChatMessage): ChatMessage {
  return message.role === 'tool'
    ? { ...message, content: fenceSavedResult(message.content) }
    : message;
}

/** After a tool result: one short line that lets the model answer now. It is the loop's own
 *  text, never saved with the chat, and only the newest one stays in the request. */
function addReminder(state: LoopState): void {
  if (state.reminder) {
    state.messages.splice(state.messages.indexOf(state.reminder), 1);
    state.transient.delete(state.reminder);
  }
  const line: ChatMessage = { role: 'user', content: AFTER_RESULT };
  state.messages.push(line);
  state.transient.add(line);
  state.reminder = line;
}

/** Remembers the size of the result a tool step just added. */
function noteResult(state: LoopState): void {
  const last = state.messages.at(-1);
  if (last?.role === 'tool') {
    state.largestResult = Math.max(state.largestResult, estimateTokens(last.content));
  }
}

async function step(
  deps: AgentDeps,
  input: AgentInput,
  state: LoopState,
): Promise<AgentResult | undefined> {
  state.steps += 1;
  fit(deps, state);
  const reply = await deps.model.chat({
    messages: [...state.messages],
    jsonSchema: actionSchema(state.tools.filter(listableTool).map((t) => t.name)),
    onToken: draftStreamer(deps.ui),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  if (input.signal?.aborted === true) return finish(deps, input, state, { status: 'stopped' });
  state.messages.push({ role: 'assistant', content: reply });
  const checked = checkAction(reply, state.tools, deps.validator);
  if (!checked.ok) return repairOrFail(deps, input, state, checked);
  state.repairUsed = false;
  if (checked.kind === 'answer') {
    deps.ui.show({ kind: 'answer', text: checked.text });
    return finish(deps, input, state, { status: 'answered', answer: checked.text });
  }
  const earlier = state.made.get(callKey(checked.tool.name, checked.args));
  if (earlier) return repeatedCall(deps, input, state, earlier);
  const ran = await runTool(deps, input, state, { tool: checked.tool, args: checked.args });
  noteResult(state);
  if (ran) addReminder(state);
  return undefined;
}

/**
 * The model asked for a call it already made in this question; it is not run again. The first
 * time the earlier result is given back with a line to answer now; the next time the question
 * ends with an answer built from the results in hand. The assistant turn that is saved holds
 * no page text, so the page's words never come back later in a trusted role.
 */
async function repeatedCall(
  deps: AgentDeps,
  input: AgentInput,
  state: LoopState,
  earlier: MadeCall,
): Promise<AgentResult | undefined> {
  state.repeats += 1;
  if (state.repeats === 1) {
    deps.ui.show({ kind: 'note', text: NOTE_AGAIN });
    state.messages.push(
      { role: 'tool', content: wrapUntrusted(earlier.name, earlier.text) },
      { role: 'user', content: NUDGE },
    );
    return undefined;
  }
  const text = builtAnswer([...state.made.values()]);
  deps.ui.show({ kind: 'note', text: NOTE_STOP });
  deps.ui.show({ kind: 'answer', text });
  state.messages.push({ role: 'assistant', content: STOPPED_REPLY });
  return finish(deps, input, state, { status: 'answered', answer: text });
}

/** Collects streamed tokens and shows the answer text so far; tool calls show nothing. */
function draftStreamer(ui: ChatUI): (token: string) => void {
  let buffer = '';
  return (token) => {
    buffer += token;
    const draft = partialAnswer(buffer);
    if (draft !== undefined) ui.showDraft(draft);
  };
}

async function repairOrFail(
  deps: AgentDeps,
  input: AgentInput,
  state: LoopState,
  failed: Extract<Checked, { ok: false }>,
): Promise<AgentResult | undefined> {
  if (state.repairUsed) {
    const error = failed.final ?? `The model gave no valid action: ${failed.reason}.`;
    deps.ui.show({ kind: 'error', text: error });
    return finish(deps, input, state, { status: 'failed', error });
  }
  state.repairUsed = true;
  state.messages.push({ role: 'user', content: REPAIR.replace('%s', () => failed.reason) });
  return undefined;
}

function siteChanged(
  deps: AgentDeps,
  input: AgentInput,
  state: LoopState,
  movedTo: string,
): Promise<AgentResult> {
  const error =
    `The tab left ${input.origin} for ${cleanPageText(movedTo)} during the question. ` +
    'The question was stopped and nothing more was run; ask again on this page.';
  deps.ui.show({ kind: 'error', text: error });
  return finish(deps, input, state, { status: 'failed', error });
}

async function finish(
  deps: AgentDeps,
  input: AgentInput,
  state: LoopState,
  outcome: { status: AgentStatus; answer?: string; error?: string },
): Promise<AgentResult> {
  await deps.memory.saveChat(
    input.origin,
    state.messages.filter((m) => m.role !== 'system' && !state.transient.has(m)),
  );
  return { ...outcome, steps: state.steps, messages: state.messages };
}
