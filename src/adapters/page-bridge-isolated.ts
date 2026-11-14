// SPDX-License-Identifier: Apache-2.0
// Logic of the isolated content script: the trust check between the page and the
// extension. It takes tools/list and tools/call from the service worker, asks the
// MAIN-world script through window.postMessage, and accepts only a reply in a valid
// PageEnvelope on its own channel, with the id it sent, that passes its schema. The page
// can see and imitate every window message, so the reply is still untrusted data; what
// this script adds itself (the origin, the linkset flag) comes from its own world. A call
// names the site its run started on, and is refused when the page is on another one.
// Tool-change notices go out at most once per 250 ms.
import type { Message, ToolsCallRequest, ToolsListRequest } from '../protocol/messages';
import { parseEnvelope, parseMessage } from '../protocol/validate';
import type { WindowLike } from './page-bridge-main';

export interface RuntimeLike {
  readonly onMessage: {
    addListener(
      listener: (
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void,
      ) => boolean | void,
    ): void;
  };
  sendMessage(message: object): Promise<unknown>;
}

export interface RelayDeps {
  readonly win: Pick<WindowLike, 'postMessage' | 'addEventListener'>;
  readonly runtime: RuntimeLike;
  readonly channel: string;
  readonly newId: () => string;
  readonly location: { readonly origin: string };
  readonly hasLinkset: () => boolean;
  readonly timeoutMs?: number;
}

type Request = ToolsListRequest | ToolsCallRequest;
type PageResult = Extract<Message, { type: 'tools/list-result' | 'tools/call-result' }>;

const TIMEOUT_MS = 10_000;
const TIMEOUT_TEXT = 'The page did not answer in time.';
export const OTHER_SITE_TEXT =
  'Tool error: the page is no longer on the site this question started on. Nothing was run.';
/** At most one tools/changed notice per this many milliseconds. */
export const NOTICE_INTERVAL_MS = 250;
const HTTP_ORIGIN = /^https?:\/\/[^/]+$/;

function failure(request: Request, text: string): object {
  return request.type === 'tools/list'
    ? { type: 'tools/list-result', id: request.id, ok: false, tools: [], error: text }
    : { type: 'tools/call-result', id: request.id, ok: false, text };
}

/** The page's reply, re-addressed to the service worker's request id. */
function answer(deps: RelayDeps, request: Request, reply: PageResult): object {
  if (reply.type === 'tools/call-result') {
    return { type: 'tools/call-result', id: request.id, ok: reply.ok, text: reply.text };
  }
  const origin = deps.location.origin;
  return {
    type: 'tools/list-result',
    id: request.id,
    ok: reply.ok,
    tools: reply.tools,
    ...(reply.error !== undefined ? { error: reply.error } : {}),
    ...(HTTP_ORIGIN.test(origin) ? { origin } : {}),
    linkset: deps.hasLinkset(),
  };
}

function expected(request: Request): PageResult['type'] {
  return request.type === 'tools/list' ? 'tools/list-result' : 'tools/call-result';
}

function relay(
  deps: RelayDeps,
  waiting: Map<string, (reply: PageResult) => void>,
  request: Request,
): Promise<object> {
  const id = deps.newId();
  const message =
    request.type === 'tools/list'
      ? { type: 'tools/list', id }
      : { type: 'tools/call', id, name: request.name, args: request.args };
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(failure(request, TIMEOUT_TEXT));
    }, deps.timeoutMs ?? TIMEOUT_MS);
    waiting.set(id, (reply) => {
      if (reply.type !== expected(request)) return;
      clearTimeout(timer);
      waiting.delete(id);
      resolve(answer(deps, request, reply));
    });
    deps.win.postMessage({ source: 'webaiassist', channel: deps.channel, message }, '*');
  });
}

/** A message from the MAIN script on this channel, or undefined. */
function fromPage(deps: RelayDeps, data: unknown): Message | undefined {
  const envelope = parseEnvelope(data);
  if (!envelope.ok || envelope.value.channel !== deps.channel) return undefined;
  const parsed = parseMessage(envelope.value.message, 'page');
  return parsed.ok ? parsed.value : undefined;
}

/** Sends a notice now, then at most one more per interval however often the page fires. */
function throttled(send: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  const open = (): void => {
    timer = setTimeout(() => {
      timer = undefined;
      if (!pending) return;
      pending = false;
      send();
      open();
    }, NOTICE_INTERVAL_MS);
  };
  return () => {
    if (timer !== undefined) {
      pending = true;
      return;
    }
    send();
    open();
  };
}

function onWindowMessage(
  deps: RelayDeps,
  waiting: Map<string, (reply: PageResult) => void>,
  data: unknown,
  notice: () => void,
): void {
  const message = fromPage(deps, data);
  if (message?.type === 'tools/changed') return notice();
  if (message?.type === 'tools/list-result' || message?.type === 'tools/call-result') {
    waiting.get(message.id)?.(message);
  }
}

/** A call that names a site is run only there. The service worker refuses a call that
 *  names none (tool-router.ts), so every call from the panel names one. */
function onOtherSite(deps: RelayDeps, request: Request): boolean {
  if (request.type !== 'tools/call' || request.origin === undefined) return false;
  return request.origin !== deps.location.origin;
}

export function startIsolatedRelay(deps: RelayDeps): void {
  const waiting = new Map<string, (reply: PageResult) => void>();
  const notice = throttled(() => {
    deps.runtime.sendMessage({ type: 'tools/changed' }).catch(() => undefined);
  });
  // Only this window's own messages: not those of frames inside the page.
  deps.win.addEventListener('message', (event) => {
    if (event.source === deps.win) onWindowMessage(deps, waiting, event.data, notice);
  });
  deps.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const parsed = parseMessage(raw, 'content');
    if (!parsed.ok) return false;
    const request = parsed.value;
    if (request.type !== 'tools/list' && request.type !== 'tools/call') return false;
    if (onOtherSite(deps, request)) {
      sendResponse(failure(request, OTHER_SITE_TEXT));
      return false;
    }
    void relay(deps, waiting, request).then(sendResponse);
    return true;
  });
}
