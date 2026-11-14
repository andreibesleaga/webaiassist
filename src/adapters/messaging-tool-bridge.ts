// SPDX-License-Identifier: Apache-2.0
// ToolBridge adapter for the side panel: lists and calls the tools of a tab through the
// service worker (chrome.runtime.sendMessage), and hears tools/changed from the tab.
// Every reply is checked against its schema before it is used.
import type {
  ToolBridge,
  ToolCallResult,
  ToolListing,
  ToolTarget,
} from '../core/ports/tool-bridge';
import type { ToolAnnotations, ToolArgs, ToolInfo } from '../core/types';
import type { ToolsListResult, WireTool } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';

export interface PageInfo {
  readonly origin: string;
  readonly linkset: boolean;
  readonly tools: readonly ToolInfo[];
  /** The page has a WebMCP interface, with or without tools; undefined when it did not say. */
  readonly webmcp?: boolean;
}

export type SendMessage = (message: object) => Promise<unknown>;

const HINTS = ['readOnlyHint', 'consequentialHint', 'untrustedContentHint'] as const;

function toAnnotations(wire: NonNullable<WireTool['annotations']>): ToolAnnotations {
  const out: { -readonly [K in keyof ToolAnnotations]: ToolAnnotations[K] } = {};
  for (const key of HINTS) if (typeof wire[key] === 'boolean') out[key] = wire[key];
  return out;
}

/** WireTool -> ToolInfo, without empty optional fields. */
export function toToolInfo(wire: WireTool): ToolInfo {
  return {
    name: wire.name,
    ...(typeof wire.title === 'string' ? { title: wire.title } : {}),
    description: wire.description,
    ...(wire.inputSchema ? { inputSchema: wire.inputSchema } : {}),
    ...(wire.annotations ? { annotations: toAnnotations(wire.annotations) } : {}),
  };
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Listing failed; `origin` is set when the page's site is known (compat mode needs it),
 *  `access` when the service worker could not add the page scripts. */
export class PageError extends Error {
  constructor(
    message: string,
    readonly origin?: string,
    readonly access?: 'denied' | 'restricted',
  ) {
    super(message);
    this.name = 'PageError';
  }
}

function pageInfo(result: ToolsListResult): PageInfo {
  const error = result.ok ? undefined : (result.error ?? 'The page did not list its tools.');
  if (error !== undefined) throw new PageError(error, result.origin, result.access);
  if (!result.origin)
    throw new PageError('WebAIAssist cannot tell which site this page belongs to.');
  return {
    origin: result.origin,
    linkset: result.linkset === true,
    tools: result.tools.map(toToolInfo),
    ...(result.webmcp === undefined ? {} : { webmcp: result.webmcp }),
  };
}

export class MessagingToolBridge implements ToolBridge {
  private readonly listeners = new Set<(tabId: number) => void>();

  constructor(
    private readonly send: SendMessage,
    private readonly newId: () => string,
  ) {}

  async page(tabId: number): Promise<PageInfo> {
    const id = this.newId();
    const reply = await this.send({ type: 'tools/list', id, tabId });
    const parsed = parseMessage(reply, 'panel');
    if (!parsed.ok || parsed.value.type !== 'tools/list-result' || parsed.value.id !== id) {
      throw new Error('The page gave a tool list WebAIAssist cannot use.');
    }
    return pageInfo(parsed.value);
  }

  async list(tabId: number): Promise<ToolListing> {
    const { origin, tools } = await this.page(tabId);
    return { origin, tools };
  }

  /** The call carries the run's origin; the page script refuses it on any other site. */
  async call(target: ToolTarget, name: string, args: ToolArgs): Promise<ToolCallResult> {
    const id = this.newId();
    const { tabId, origin } = target;
    let reply: unknown;
    try {
      reply = await this.send({ type: 'tools/call', id, tabId, origin, name, args });
    } catch (error) {
      return { ok: false, text: `Tool error: ${errorText(error)}` };
    }
    const parsed = parseMessage(reply, 'panel');
    if (!parsed.ok || parsed.value.type !== 'tools/call-result' || parsed.value.id !== id) {
      return { ok: false, text: 'Tool error: the page gave an answer WebAIAssist cannot use.' };
    }
    return { ok: parsed.value.ok, text: parsed.value.text };
  }

  onChange(listener: (tabId: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Feed chrome.runtime.onMessage here: a tools/changed notice, accepted only from the
   *  top frame of a tab, tells the listeners. */
  notify(
    raw: unknown,
    sender: { readonly tab?: { readonly id?: number }; readonly frameId?: number },
  ): void {
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number' || sender.frameId !== 0) return;
    const parsed = parseMessage(raw, 'content');
    if (!parsed.ok || parsed.value.type !== 'tools/changed') return;
    this.listeners.forEach((listener) => listener(tabId));
  }
}
