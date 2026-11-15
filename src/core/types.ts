// SPDX-License-Identifier: Apache-2.0
// Plain data types shared by the core and its ports. No browser types here.

/** A JSON Schema object, as a page gives it in a tool's inputSchema. */
export type JsonSchema = Readonly<Record<string, unknown>>;

/** Tool arguments: a JSON object. */
export type ToolArgs = Readonly<Record<string, unknown>>;

/** The WebMCP annotation hints the core reads. */
export interface ToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly consequentialHint?: boolean;
  readonly untrustedContentHint?: boolean;
  /** For developers: the model is not offered the tool (the user still sees and may run it). */
  readonly debugging?: boolean;
}

/** What a tool's page says it is a form: it waits for Submit, or the browser submits. */
export interface ToolForm {
  readonly autosubmit: boolean;
  /** Kinds of sensitive fields the form holds (tool-review.ts, form-tools.ts). */
  readonly sensitive: ('password' | 'payment' | 'personal')[];
}

/** A reason a tool needs a closer look (tool-review.ts); `detail` is a short fixed word or a name. */
export interface ToolFlag {
  readonly id: string;
  readonly detail?: string;
}

/** One tool as the page lists it (WebMCP `getTools()` without `execute`). */
export interface ToolInfo {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: JsonSchema;
  readonly annotations?: ToolAnnotations;
  /** Set when the page says the tool is one of its forms (declarative WebMCP). */
  readonly form?: ToolForm;
  /** Written by the extension, never by the page: why the tool is flagged (tool-review.ts). */
  readonly review?: readonly ToolFlag[];
  /** Written by WebAIAssist, not by the page (builtin-tools.ts); no page tool can have it. */
  readonly builtin?: true;
}

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  readonly role: Role;
  readonly content: string;
}

/** The part of an AbortSignal the core reads. A real AbortSignal fits this shape. */
export interface CancelSignal {
  readonly aborted: boolean;
}
