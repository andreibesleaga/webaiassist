// SPDX-License-Identifier: Apache-2.0
import type {
  ToolBridge,
  ToolCallResult,
  ToolListing,
  ToolTarget,
} from '../core/ports/tool-bridge';
import type { ToolArgs, ToolInfo } from '../core/types';

export type FakeHandler = (args: ToolArgs) => ToolCallResult | Promise<ToolCallResult>;

export interface FakeCall {
  readonly tabId: number;
  readonly name: string;
  readonly args: ToolArgs;
}

/**
 * A page with a fixed tool list. Each call runs a handler or returns a default text.
 * `origin` is the site the page reports; left unset, the listing names no site.
 */
export class FakeToolBridge implements ToolBridge {
  origin: string | undefined;
  readonly calls: FakeCall[] = [];
  private tools: readonly ToolInfo[];
  private readonly handlers = new Map<string, FakeHandler>();
  private readonly listeners = new Set<(tabId: number) => void>();

  constructor(tools: readonly ToolInfo[], origin?: string) {
    this.tools = tools;
    this.origin = origin;
  }

  handle(name: string, handler: FakeHandler): this {
    this.handlers.set(name, handler);
    return this;
  }

  /** Replaces the tool list, as a page would, and tells the listeners. */
  replaceTools(tabId: number, tools: readonly ToolInfo[]): void {
    this.tools = tools;
    this.listeners.forEach((listener) => listener(tabId));
  }

  list(): Promise<ToolListing> {
    const origin = this.origin;
    return Promise.resolve(
      origin === undefined ? { tools: this.tools } : { origin, tools: this.tools },
    );
  }

  async call(target: ToolTarget, name: string, args: ToolArgs): Promise<ToolCallResult> {
    this.calls.push({ tabId: target.tabId, name, args });
    const handler = this.handlers.get(name);
    if (handler) return handler(args);
    return { ok: true, text: JSON.stringify({ tool: name, trust: 'untrusted' }) };
  }

  onChange(listener: (tabId: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
