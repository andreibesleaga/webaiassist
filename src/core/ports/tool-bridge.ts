// SPDX-License-Identifier: Apache-2.0
import type { CancelSignal, ToolArgs, ToolInfo } from '../types';

export interface ToolCallResult {
  readonly ok: boolean;
  /** The tool's result as text (WebMCP `executeTool` resolves with a string). */
  readonly text: string;
}

/** The tools of the page in a tab, and the site (origin) that page is on. */
export interface ToolListing {
  /**
   * The page's origin as the extension's own page script read it (the page cannot set it).
   * Left out only by a bridge that has no page behind it, such as "no tools".
   */
  readonly origin?: string;
  readonly tools: readonly ToolInfo[];
}

/** Where a call goes: the tab, and the site the run was started on. */
export interface ToolTarget {
  readonly tabId: number;
  /** The page refuses the call when it is no longer on this origin. */
  readonly origin: string;
}

/** Port: the tools that the page in a tab registers. */
export interface ToolBridge {
  list(tabId: number): Promise<ToolListing>;
  call(
    target: ToolTarget,
    name: string,
    args: ToolArgs,
    signal?: CancelSignal,
  ): Promise<ToolCallResult>;
  /** Calls `listener` when a tab's tool list changes; returns a function that stops it. */
  onChange(listener: (tabId: number) => void): () => void;
}
