// SPDX-License-Identifier: Apache-2.0
// One tool call of the agent loop: check the page is still on the run's site and the tool
// is unchanged, ask through the confirmation gate, check again, call, record, fence.
import { needsConfirmation, sameTool } from './gate';
import type { HistorySpan } from './history';
import { listedTools, runBuiltin } from './builtin-step';
import type { ArgsValidator } from './ports/args-validator';
import type { ChatUI } from './ports/chat-ui';
import type { Clock } from './ports/clock';
import type { GraphQuery } from './ports/graph-query';
import type { Memory } from './ports/memory';
import type { ModelRuntime } from './ports/model-runtime';
import type { ToolBridge, ToolCallResult, ToolListing } from './ports/tool-bridge';
import { callKey, type MadeCall } from './repeat';
import { listableTool, quoteName } from './sanitize';
import type { CancelSignal, ChatMessage, ToolArgs, ToolInfo } from './types';
import { wrapUntrusted } from './untrusted';

export interface AgentDeps {
  readonly model: ModelRuntime;
  readonly bridge: ToolBridge;
  readonly memory: Memory;
  readonly ui: ChatUI;
  readonly clock: Clock;
  readonly validator: ArgsValidator;
  /** Asked before each tool call, ahead of the question about that call: false when the user
   *  did not allow the tools of this site (site-consent.ts). Absent: the site is allowed. */
  readonly siteGate?: () => Promise<boolean>;
  /** The built-in graph tool (builtin-tools.ts); offered only when the scope says so. */
  readonly builtin?: GraphQuery;
}

/** What a tool step needs to know about the run. */
export interface RunScope {
  readonly tabId: number;
  /** The site the run was started on; every listing and call is bound to it. */
  readonly origin: string;
  readonly signal?: CancelSignal;
  readonly confirmEveryCall?: boolean;
  /** The panel offers the built-in graph tool on this run. */
  readonly graphQuery?: boolean;
}

export interface LoopState {
  readonly messages: ChatMessage[];
  tools: readonly ToolInfo[];
  steps: number;
  repairUsed: boolean;
  /** Tools the user denied in this run: a retry is refused without asking again. */
  readonly denied: Set<string>;
  /** Calls that ran in this question, by tool and arguments (repeat.ts): none runs twice. */
  readonly made: Map<string, MadeCall>;
  /** Times the model asked for a call that had already run in this question. */
  repeats: number;
  /** Set when the tab left the run's site: the run ends without calling anything. */
  movedTo?: string;
  /** The saved chat's place in `messages` (history.ts trims it to the context window). */
  readonly history: HistorySpan;
  /** Tokens of the largest tool result of this run: room is kept for one more that size. */
  largestResult: number;
  /** Messages of this run that are never saved with the chat (the site facts). */
  readonly transient: Set<ChatMessage>;
  /** The line after the latest tool result (tool-rules.ts, AFTER_RESULT): only the newest stays. */
  reminder?: ChatMessage;
}

export type Call = { readonly tool: ToolInfo; readonly args: ToolArgs };

/** The tab's tools the model may use (sanitize.ts, listableTool), or undefined (and
 *  `state.movedTo` set) when the tab left the site. */
export async function listOnSite(
  deps: AgentDeps,
  scope: RunScope,
  state: Pick<LoopState, 'movedTo'>,
): Promise<ToolListing | undefined> {
  const listing = await deps.bridge.list(scope.tabId);
  if (listing.origin === undefined || listing.origin === scope.origin) {
    return { ...listing, tools: listedTools(deps, scope, listing.tools.filter(listableTool)) };
  }
  state.movedTo = listing.origin;
  return undefined;
}

/** Lists the tools again; false (and the call is refused) when the tool or the site changed. */
async function stillSame(deps: AgentDeps, scope: RunScope, state: LoopState, call: Call) {
  const fresh = await listOnSite(deps, scope, state);
  if (!fresh) return false;
  const name = call.tool.name;
  if (
    sameTool(
      call.tool,
      fresh.tools.find((t) => t.name === name),
    )
  )
    return true;
  state.tools = fresh.tools;
  const text = `The page changed the tool "${quoteName(name)}" after it was listed. The call was refused.`;
  deps.ui.show({ kind: 'error', text });
  state.messages.push({ role: 'tool', content: text });
  return false;
}

/** The site question, asked when a tool is first about to be used. */
async function siteOpen(deps: AgentDeps, state: LoopState, call: Call): Promise<boolean> {
  if (!deps.siteGate || (await deps.siteGate())) return true;
  const text = `The user did not allow the tools of this site. "${quoteName(call.tool.name)}" was not run.`;
  state.messages.push({ role: 'tool', content: text });
  return false;
}

/** The confirmation gate; a tool denied once in this run is refused without asking. */
async function allowed(deps: AgentDeps, scope: RunScope, state: LoopState, call: Call) {
  const name = call.tool.name;
  const ask = scope.confirmEveryCall === true || needsConfirmation(call.tool);
  if (!ask) return true;
  const again = state.denied.has(name);
  if (!again && (await deps.ui.confirmToolCall({ ...call, origin: scope.origin }))) return true;
  state.denied.add(name);
  deps.ui.show({ kind: 'tool-denied', name });
  const quoted = quoteName(name);
  const text = again
    ? `The user already denied "${quoted}" in this question. It was not run.`
    : `The user denied the call to "${quoted}".`;
  state.messages.push({ role: 'tool', content: text });
  return false;
}

async function safeCall(deps: AgentDeps, scope: RunScope, call: Call): Promise<ToolCallResult> {
  const target = { tabId: scope.tabId, origin: scope.origin };
  try {
    return await deps.bridge.call(target, call.tool.name, call.args, scope.signal);
  } catch (error) {
    return {
      ok: false,
      text: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Runs one call through the gates; true when it ran and its result is now in the chat. */
export async function runTool(
  deps: AgentDeps,
  scope: RunScope,
  state: LoopState,
  call: Call,
): Promise<boolean> {
  if (call.tool.builtin === true) {
    // The built-in tool reads the site's graph, so the site question comes first for it too.
    if (!(await siteOpen(deps, state, call))) return false;
    return runBuiltin(deps, scope, state, call);
  }
  // Checked before the question and again after it: the page may change the tool, or the
  // tab may leave the site, while the user decides.
  if (!(await stillSame(deps, scope, state, call))) return false;
  if (!(await siteOpen(deps, state, call))) return false;
  if (!(await allowed(deps, scope, state, call))) return false;
  if (!(await stillSame(deps, scope, state, call))) return false;
  const name = call.tool.name;
  deps.ui.show({ kind: 'tool-call', name, args: call.args });
  const result = await safeCall(deps, scope, call);
  await deps.memory.recordToolResult(scope.origin, name, result.ok, deps.clock.nowIso());
  deps.ui.show({ kind: 'tool-result', name, ok: result.ok, text: result.text });
  state.made.set(callKey(name, call.args), { name, text: result.text });
  state.messages.push({ role: 'tool', content: wrapUntrusted(name, result.text) });
  return true;
}
