// SPDX-License-Identifier: Apache-2.0
// Service-worker routing of tools/list and tools/call from the side panel to a tab.
// The page scripts are added only when a request finds nobody listening in the tab:
// with activeTab that works after the user clicked the toolbar button on the page, or on
// a site the user allowed. When they cannot be added, a listing says why (`access`), so
// the panel can offer Allow or say the page cannot be used. The tab's reply is checked
// against its schema again here.
import { accessProblem, accessText, type AccessProblem } from './page-access';
import type {
  ToolsCallRequest,
  ToolsCallResult,
  ToolsCancel,
  ToolsListRequest,
  ToolsListResult,
} from '../protocol/messages';
import { parseMessage } from '../protocol/validate';

export interface TabDeps {
  sendToTab(tabId: number, message: object): Promise<unknown>;
  inject(tabId: number): Promise<void>;
}

type Request = ToolsListRequest | ToolsCallRequest | ToolsCancel;
type Result = ToolsListResult | ToolsCallResult;

const UNUSABLE = 'The page gave an answer WebAIAssist cannot use.';

function failure(request: Request, text: string, access?: AccessProblem): Result {
  if (request.type !== 'tools/list') {
    return { type: 'tools/call-result', id: request.id, ok: false, text };
  }
  const result: ToolsListResult = {
    type: 'tools/list-result',
    id: request.id,
    ok: false,
    tools: [],
    error: text,
  };
  return access === undefined ? result : { ...result, access };
}

/** The request without the tab id, which only the service worker needs. A call keeps the
 *  run's origin, which the isolated script checks against the page's own. */
function forTab(request: Request): object {
  if (request.type === 'tools/list') return { type: 'tools/list', id: request.id };
  if (request.type === 'tools/cancel') return { type: 'tools/cancel', id: request.id };
  const { id, origin, name, args } = request;
  return { type: 'tools/call', id, ...(origin === undefined ? {} : { origin }), name, args };
}

function checkReply(request: Request, reply: unknown): Result {
  const parsed = parseMessage(reply, 'content');
  const type = request.type === 'tools/list' ? 'tools/list-result' : 'tools/call-result';
  if (!parsed.ok || parsed.value.type !== type || parsed.value.id !== request.id) {
    return failure(request, UNUSABLE);
  }
  return parsed.value;
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const CLOSED = /closed before a response|channel closed/i;
const closedBeforeAnswer = (error: unknown): boolean => CLOSED.test(errorText(error));

function closedFailure(request: ToolsCallRequest, error: unknown): ToolsCallResult {
  const text = `The page did not answer (the page navigated, or closed the connection): ${errorText(error)}`;
  return { type: 'tools/call-result', id: request.id, ok: false, text };
}

async function ask(request: Request, tabId: number, deps: TabDeps): Promise<Result> {
  const message = forTab(request);
  try {
    return checkReply(request, await deps.sendToTab(tabId, message));
  } catch (error) {
    // The page closed the connection while a call ran (it navigated): the call is not sent again.
    if (request.type === 'tools/call' && closedBeforeAnswer(error))
      return closedFailure(request, error);
    // Nobody listens in the tab yet: add the page scripts, then try once more.
  }
  try {
    await deps.inject(tabId);
  } catch (error) {
    const problem = accessProblem(error);
    return failure(request, accessText(problem), problem);
  }
  try {
    return checkReply(request, await deps.sendToTab(tabId, message));
  } catch (error) {
    return failure(request, `The page did not answer: ${errorText(error)}`);
  }
}

/** Stop: sent to the tab only if its page scripts are there; nobody listening means nothing runs. */
async function cancel(request: ToolsCancel, tabId: number, deps: TabDeps): Promise<Result> {
  try {
    return checkReply(request, await deps.sendToTab(tabId, forTab(request)));
  } catch {
    return { type: 'tools/call-result', id: request.id, ok: true, text: '' };
  }
}

export async function routeToolRequest(request: Request, deps: TabDeps): Promise<Result> {
  if (typeof request.tabId !== 'number') return failure(request, 'No tab was given.');
  if (request.type === 'tools/cancel') return cancel(request, request.tabId, deps);
  // A call is bound to the site its run started on; the isolated script checks it.
  if (request.type === 'tools/call' && request.origin === undefined) {
    return failure(request, 'Tool error: no site was given for the call.');
  }
  return ask(request, request.tabId, deps);
}
