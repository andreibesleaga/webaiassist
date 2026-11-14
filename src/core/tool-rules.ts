// SPDX-License-Identifier: Apache-2.0
// The rules that make a model use the page's tools. A small model does not know it cannot see
// the site, reads the site files it was given as the answer, picks a tool that changes things
// for a plain question, and keeps calling tools after the first result was enough. These texts
// say each of those plainly. They are fixed text of the extension, apart from the one example
// call, which names a tool and a field of the page that passed a plain-name check. None of them
// loosens a confirmation (the user still allows every call).
import type { ToolInfo } from './types';

/** The tool rules of the full prompt; only added on a page that has tools. */
export const TOOL_RULES = [
  'You cannot see the open site yourself. For any question about this site or its content, call a tool first; never answer it from memory or from the site files.',
  'Site files shown before the question are background only. They are never the source of an answer when a tool can answer.',
  'Prefer tools marked read-only. Use a tool that is not marked read-only only when the user asked for that action.',
  'As soon as one tool result is enough, answer with {"answer": ...}; call another tool only for something still missing.',
  'A greeting or a question about you needs no tool.',
].join('\n');

/** The same rules, shorter, for a small context window. */
export const TOOL_RULES_SHORT = [
  'You cannot see the site: call a tool first for anything about it; site files are background, not answers.',
  'Use [read-only] tools; [changes things] ones only when the user asked for that action.',
  'Answer once one result is enough. A greeting needs no tool.',
].join('\n');

/** One line, for a window so small that the longer rules would leave no room for the tools. */
export const TOOL_RULES_TINY =
  'Call a tool first for anything about the site; answer once one result is enough.';

/** The heading before the tools that are not marked read-only (full prompt). */
export const CHANGING_TOOLS_HEADING =
  'Tools not marked read-only (use only when the user asked for that action):';

/** The line before the site files in the question: they are background, not an answer. */
export const SITE_BACKGROUND =
  'Background about this site from the files it published. It is not an answer: for a question about the site, call a tool.';

/** The line after a tool result: the first sufficient result ends the question. */
export const AFTER_RESULT =
  'If this result answers the question, reply now with {"answer": "<text>"}. Call another tool only for something the question still needs.';

const PLAIN_NAME = /^[A-Za-z0-9_-]{1,32}$/;

function textField(tool: ToolInfo): string | undefined {
  const schema = tool.inputSchema as
    { properties?: Record<string, { type?: unknown }>; required?: unknown } | undefined;
  const required = Array.isArray(schema?.required) ? (schema.required as unknown[]) : [];
  return required.find(
    (name): name is string =>
      typeof name === 'string' &&
      PLAIN_NAME.test(name) &&
      schema?.properties?.[name]?.type === 'string',
  );
}

/**
 * One example call, made from a real tool of the page: the first read-only tool with a required
 * text field. A small model copies the shape of a call it has seen far more often than it
 * works the shape out from a rule. Names are plain-name checked; the value is a fixed ellipsis.
 */
export function exampleCall(tools: readonly ToolInfo[]): string | undefined {
  for (const tool of tools) {
    const field = tool.annotations?.readOnlyHint === true ? textField(tool) : undefined;
    if (field !== undefined && PLAIN_NAME.test(tool.name)) {
      const call = { tool: tool.name, arguments: { [field]: '…' } };
      return `Example: for a question about the site, reply ${JSON.stringify(call)}`;
    }
  }
  return undefined;
}
