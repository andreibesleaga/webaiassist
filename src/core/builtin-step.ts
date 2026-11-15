// SPDX-License-Identifier: Apache-2.0
// The built-in graph tool inside the agent loop (builtin-tools.ts says what it is). The loop's own
// files call the two functions here: `listedTools` when the tools are listed, and `runBuiltin` for a call
// of the built-in tool. A call is not a page tool: it skips the page bridge and the "tool changed" check
// (it reads files the node published and the tab already read, writes nothing, sends nothing). The
// site question comes first, then the per-call question only when the user chose "ask for every call"
// (tool-step.ts); the result is shown, recorded and fenced as untrusted data like any tool result.
import { failureText, mergeTools, QUERY_TOOL, STOP_NOTE } from './builtin-tools';
import type { GraphQuery, QueryOutcome } from './ports/graph-query';
import { callKey } from './repeat';
import type { AgentDeps, Call, LoopState, RunScope, ToolDeps } from './tool-step';
import type { ToolArgs, ToolInfo } from './types';
import { wrapUntrusted } from './untrusted';

/** Characters of rows that go to the model: 3,000, or 1,500 in a small window. */
const RESULT_CAP = 3000;
const COMPACT_RESULT_CAP = 1500;
/** After this many failed queries in one question no more are run. */
const MAX_FAILURES = 2;

/** Failed queries of a question, by loop state (the state type is the loop's, not extended here). */
const failures = new WeakMap<object, number>();

/** The page's listable tools without any reserved name, and the built-in tool when it is offered. */
export function listedTools(
  deps: Pick<AgentDeps, 'builtin'>,
  scope: Pick<RunScope, 'graphQuery'>,
  pageTools: readonly ToolInfo[],
): readonly ToolInfo[] {
  const offered = deps.builtin !== undefined && scope.graphQuery === true;
  return mergeTools(pageTools, offered ? QUERY_TOOL : undefined).tools;
}

async function ask(builtin: GraphQuery | undefined, scope: RunScope, args: ToolArgs) {
  if (!builtin) return { ok: false, text: 'The graph tool is not available.' };
  const place = { tabId: scope.tabId, origin: scope.origin };
  const sparql = typeof args.sparql === 'string' ? args.sparql.trim() : '';
  try {
    return sparql === ''
      ? await builtin.summary(place, scope.signal)
      : await builtin.run(place, sparql, scope.signal);
  } catch (error) {
    return {
      ok: false,
      text: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
    } satisfies QueryOutcome;
  }
}

/** The text the model reads: a failure carries one line on what to do next. */
function modelText(state: LoopState, outcome: QueryOutcome): string {
  if (outcome.ok) return outcome.text;
  const count = (failures.get(state) ?? 0) + 1;
  failures.set(state, count);
  return failureText(outcome.text, count);
}

export async function runBuiltin(
  deps: ToolDeps,
  scope: RunScope,
  state: LoopState,
  call: Call,
): Promise<boolean> {
  const name = call.tool.name;
  deps.ui.show({ kind: 'tool-call', name, args: call.args });
  const stopped = (failures.get(state) ?? 0) >= MAX_FAILURES;
  const outcome: QueryOutcome = stopped
    ? { ok: false, text: STOP_NOTE }
    : await ask(deps.builtin, scope, call.args);
  const text = stopped ? STOP_NOTE : modelText(state, outcome);
  await deps.memory.recordToolResult(scope.origin, name, outcome.ok, deps.clock.nowIso());
  deps.ui.show({ kind: 'tool-result', name, ok: outcome.ok, text: outcome.text });
  state.made.set(callKey(name, call.args), { name, text });
  const compact = deps.model?.capabilities().compactPrompt === true;
  const cap = compact ? COMPACT_RESULT_CAP : RESULT_CAP;
  state.messages.push({ role: 'tool', content: wrapUntrusted(name, text, cap) });
  // True when rows came back: only then does the loop add its "answer now" line.
  return outcome.ok;
}
