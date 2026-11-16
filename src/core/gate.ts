// SPDX-License-Identifier: Apache-2.0
// The confirmation gate: which tool calls need the user's Allow, and whether a tool
// still matches what the user and the model saw when it was listed.
import type { ToolInfo } from './types';

/**
 * Read-only and not consequential: runs without asking.
 * Consequential, not read-only, or no annotations at all: asks every time.
 */
export function needsConfirmation(tool: ToolInfo): boolean {
  const hints = tool.annotations;
  if (!hints || hints.consequentialHint === true) return true;
  return hints.readOnlyHint !== true;
}

/**
 * Asks whatever the mode: the gate above, or a tool the security review flagged (tool-review.ts).
 * A flagged tool is never run without a question, in every confirmation mode.
 */
export function mustAsk(tool: ToolInfo): boolean {
  return needsConfirmation(tool) || (tool.review?.length ?? 0) > 0;
}

/** JSON with object keys sorted at every depth, so two equal values give one string. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const fingerprint = (tool: ToolInfo): string =>
  canonicalJson([
    tool.name,
    tool.title,
    tool.description,
    tool.inputSchema,
    tool.annotations,
    tool.form,
  ]);

/** True when `current` has the same name, title, description, schema, annotations and form
 *  promise as `seen`: the question showed all of them. */
export function sameTool(seen: ToolInfo, current: ToolInfo | undefined): boolean {
  return current !== undefined && fingerprint(seen) === fingerprint(current);
}
