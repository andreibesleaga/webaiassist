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
  canonicalJson([tool.name, tool.description, tool.inputSchema, tool.annotations]);

/** True when `current` has the same name, description, schema and annotations as `seen`. */
export function sameTool(seen: ToolInfo, current: ToolInfo | undefined): boolean {
  return current !== undefined && fingerprint(seen) === fingerprint(current);
}
