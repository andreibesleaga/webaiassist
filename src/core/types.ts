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
}

/** One tool as the page lists it (WebMCP `getTools()` without `execute`). */
export interface ToolInfo {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: JsonSchema;
  readonly annotations?: ToolAnnotations;
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
