// SPDX-License-Identifier: Apache-2.0
// In-memory fakes for the page bridge tests and the fixture replay: a window whose
// postMessage reaches every listener on a later task (as in a browser, both the MAIN and
// the isolated world see every message), a content-script runtime that chrome.tabs
// .sendMessage can reach, and a WebMCP `document.modelContext` built from tool fixtures.
import type { ToolInfo } from '../../src/core/types';
import { stubResult } from '../../src/spike/stub-node';

type WindowListener = (event: { data: unknown; source?: unknown }) => void;

/** Waits until queued window messages and the promise chains they start have run. */
export async function settle(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

export class FakeWindow {
  readonly location: { origin: string };
  readonly posted: unknown[] = [];
  private readonly listeners: WindowListener[] = [];

  constructor(origin = 'https://node.example') {
    this.location = { origin };
  }

  postMessage(message: unknown, _targetOrigin: string): void {
    this.posted.push(message);
    const data: unknown = structuredClone(message);
    setTimeout(() => this.listeners.forEach((listener) => listener({ data, source: this })), 0);
  }

  /** A message event from another window, such as a frame inside the page. */
  dispatchFrom(source: unknown, data: unknown): void {
    this.listeners.forEach((listener) => listener({ data, source }));
  }

  addEventListener(type: string, listener: WindowListener): void {
    if (type === 'message') this.listeners.push(listener);
  }
}

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

/** The content script's chrome.runtime: `deliver` is what chrome.tabs.sendMessage does. */
export class FakeContentRuntime {
  readonly toExtension: unknown[] = [];
  readonly onMessage = {
    addListener: (listener: RuntimeListener): void => {
      this.listeners.push(listener);
    },
  };
  private readonly listeners: RuntimeListener[] = [];

  sendMessage(message: object): Promise<unknown> {
    this.toExtension.push(structuredClone(message));
    return Promise.resolve(undefined);
  }

  deliver(message: unknown): Promise<unknown> {
    if (this.listeners.length === 0) {
      return Promise.reject(
        new Error('Could not establish connection. Receiving end does not exist.'),
      );
    }
    return new Promise((resolve, reject) => {
      const copy: unknown = structuredClone(message);
      const waits = this.listeners.map((listener) => listener(copy, { id: 'ext' }, resolve));
      if (!waits.includes(true)) {
        reject(new Error('The message port closed before a response was received.'));
      }
    });
  }
}

export type ToolHandler = (name: string, args: unknown) => unknown;

/** A WebMCP registry with the shape of getTools() entries in Chromium 156 and 157. */
export class FakeModelContext {
  readonly executed: { name: string; args: unknown }[] = [];
  private tools: readonly ToolInfo[];
  private readonly changeListeners: (() => void)[] = [];

  constructor(
    private readonly origin: string,
    tools: readonly ToolInfo[],
    private readonly handler: ToolHandler = (name, args) => stubResult(name, args),
  ) {
    this.tools = tools;
  }

  getTools(): Promise<unknown[]> {
    return Promise.resolve(
      this.tools.map((t) => ({
        name: t.name,
        title: t.title ?? '',
        description: t.description,
        origin: this.origin,
        ...(t.inputSchema ? { inputSchema: structuredClone(t.inputSchema) } : {}),
        ...(t.annotations ? { annotations: { ...t.annotations } } : {}),
      })),
    );
  }

  async executeTool(entry: unknown, input?: object): Promise<string> {
    const name = (entry as { name?: unknown }).name;
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) throw Object.assign(new Error('No such tool'), { name: 'NotFoundError' });
    this.executed.push({ name: tool.name, args: input ?? {} });
    const result = await this.handler(tool.name, input ?? {});
    return typeof result === 'string' ? result : JSON.stringify(result);
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'toolchange') this.changeListeners.push(listener);
  }

  /** Replaces the tool list, as a page would, and fires toolchange. */
  replace(tools: readonly ToolInfo[]): void {
    this.tools = tools;
    this.changeListeners.forEach((listener) => listener());
  }
}
