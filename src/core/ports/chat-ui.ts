// SPDX-License-Identifier: Apache-2.0
import type { ToolArgs, ToolInfo } from '../types';
import type { LoadProgress } from './model-runtime';

/** What the agent loop shows to the user while it runs. */
export type LoopEvent =
  | { readonly kind: 'answer'; readonly text: string }
  | { readonly kind: 'tool-call'; readonly name: string; readonly args: ToolArgs }
  | {
      readonly kind: 'tool-result';
      readonly name: string;
      readonly ok: boolean;
      /** The page's result text, shown as untrusted content. */
      readonly text: string;
    }
  | { readonly kind: 'tool-denied'; readonly name: string }
  | { readonly kind: 'error'; readonly text: string }
  /** One plain line about what the loop did on its own, such as a repeated call it did not run. */
  | { readonly kind: 'note'; readonly text: string };

export interface ToolCallApproval {
  readonly tool: ToolInfo;
  readonly args: ToolArgs;
  /** The site (origin) whose tool would run. */
  readonly origin: string;
}

/** Port: the chat surface (the side panel in the extension). */
export interface ChatUI {
  show(event: LoopEvent): void;
  /** Shows the tool name and arguments; resolves true on Allow, false on Deny. */
  confirmToolCall(request: ToolCallApproval): Promise<boolean>;
  /** The answer text streamed so far, before the reply ends. */
  showDraft(text: string): void;
  showProgress(progress: LoadProgress): void;
}
