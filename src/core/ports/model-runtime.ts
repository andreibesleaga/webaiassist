// SPDX-License-Identifier: Apache-2.0
import type { CancelSignal, ChatMessage, JsonSchema } from '../types';

export interface ModelCapabilities {
  /** The runtime accepts tool definitions and returns native tool calls. */
  readonly nativeToolCalls: boolean;
  /** The runtime can constrain output to a JSON schema. */
  readonly jsonConstraint: boolean;
  /** The context window in tokens; the agent loop keeps the saved chat inside it. */
  readonly contextTokens: number;
  /** The runtime has a small window: the core sends the short rules and tool list. */
  readonly compactPrompt?: boolean;
  /** Tokens the runtime keeps free for the reply; the core's default applies when absent. */
  readonly replyTokens?: number;
  /** A small model that chooses the page's own tools better without WebAIAssist's built-in graph
   *  tool beside them: the built-in tool is offered only on a page with no tools of its own. */
  readonly pageToolsFirst?: boolean;
}

export interface LoadProgress {
  /** 0 to 1. */
  readonly fraction: number;
  readonly text: string;
}

/** What a service reports for one chat call. Every field is optional: a local server may send
 *  only the counts, and a service sends a price only when it charges. */
export interface ModelUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  /** The price of the call in US dollars (OpenRouter: `usage.cost`, in credits). */
  readonly costUsd?: number;
}

export interface ChatRequest {
  readonly messages: readonly ChatMessage[];
  /** When set, the runtime should constrain its reply to this schema. */
  readonly jsonSchema?: JsonSchema;
  readonly signal?: CancelSignal;
  readonly onToken?: (token: string) => void;
  /** Called once per chat call, after the last token, when the runtime knows the usage. Only
   *  the endpoint runtime reports it; the others never call it. */
  readonly onUsage?: (usage: ModelUsage) => void;
}

/** Port: a language model that runs on the user's machine. */
export interface ModelRuntime {
  /** Loads (and downloads, the first time) a model; `signal` cancels the download. */
  load(
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    signal?: CancelSignal,
  ): Promise<void>;
  /** Streams tokens through `onToken` and resolves with the full reply text. */
  chat(request: ChatRequest): Promise<string>;
  unload(): Promise<void>;
  capabilities(): ModelCapabilities;
  /** Where the loaded model runs, when the runtime knows (for the panel's status line). */
  where?(): string | undefined;
}
