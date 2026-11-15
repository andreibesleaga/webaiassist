// SPDX-License-Identifier: Apache-2.0
// Port and record types of the activity log: one entry per question, kept only in this browser.
// An entry holds names, counts, sizes and times. The question, the tool arguments and the tool
// results are in it only when the user turned on "include content" (default off).

/** Where the model ran. */
export type PlaceKind = 'gpu' | 'cpu' | 'chrome' | 'own-server' | 'remote';
/** What happened to a tool call at the confirmation step. */
export type Decision = 'not-asked' | 'allowed' | 'denied';
export type Outcome = 'answered' | 'stopped' | 'step-limit' | 'error';

/** `none`: a local model, no price. `reported`: the service sent a price. `unknown`: a remote
 *  service that sent no price. */
export type CostKind = 'none' | 'reported' | 'unknown';

/** Estimated tokens in the window of one model call, by part. Always an estimate. */
export interface ContextUse {
  readonly instructions: number;
  readonly tools: number;
  /** Site files and the text of the page the user asked to read. */
  readonly site: number;
  readonly chat: number;
  /** The reply of that call. */
  readonly reply: number;
}

export interface ModelCall {
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** True when the runtime reported no count and it was estimated from the text. */
  readonly estimated: boolean;
  /** US dollars, when the service sent a price. */
  readonly costUsd?: number;
  readonly firstTokenMs?: number;
  readonly totalMs: number;
  readonly context: ContextUse;
}

export interface ToolCall {
  readonly name: string;
  /** A tool of WebAIAssist itself, not of the page. */
  readonly builtin: boolean;
  readonly at: string;
  readonly asked: boolean;
  readonly decision: Decision;
  /** Names of the arguments; their values are kept only with "include content". */
  readonly argNames: readonly string[];
  readonly argBytes: number;
  readonly durationMs?: number;
  readonly resultBytes?: number;
  readonly ok?: boolean;
  readonly error?: string;
  readonly args?: unknown;
  readonly result?: string;
}

export interface QuestionRecord {
  readonly id: string;
  /** ISO time the question was asked. */
  readonly at: string;
  /** The day, `YYYY-MM-DD`, for the filter and the per-day totals. */
  readonly day: string;
  readonly origin: string;
  readonly model: string;
  readonly place: PlaceKind;
  /** The host the chat went to, for an endpoint. */
  readonly host?: string;
  readonly windowTokens: number;
  readonly steps: number;
  readonly firstTokenMs?: number;
  readonly totalMs: number;
  readonly outcome: Outcome;
  readonly error?: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly tokensEstimated: boolean;
  readonly cost: { readonly kind: CostKind; readonly usd?: number };
  /** The model call that used the most of the window. */
  readonly context: ContextUse;
  readonly calls: readonly ModelCall[];
  readonly tools: readonly ToolCall[];
  readonly includeContent: boolean;
  readonly text?: string;
  /** Size of this entry in the store, for the size cap (activity-cap.ts). */
  readonly bytes: number;
}

/** Port: where the log is kept. The adapter keeps it in this browser. */
export interface ActivityLog {
  append(record: QuestionRecord): Promise<void>;
  /** Every entry, oldest first. */
  list(): Promise<readonly QuestionRecord[]>;
  /** Removes every entry of one site. */
  forgetSite(origin: string): Promise<void>;
  clear(): Promise<void>;
  includeContent(): Promise<boolean>;
  setIncludeContent(on: boolean): Promise<void>;
}
