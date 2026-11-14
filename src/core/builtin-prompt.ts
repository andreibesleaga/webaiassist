// SPDX-License-Identifier: Apache-2.0
// How the built-in tool is written into the system prompt: in its own section, under a heading that says
// WebAIAssist wrote it and the page did not, after the page's tools (which carry the opposite heading).
// A page tool can never be listed here: builtin-tools.ts removes every page tool with a reserved name.
import { GRAPH_HINT } from './builtin-tools';
import type { ToolInfo } from './types';

export const BUILTIN_HEADING = 'Built-in tool (written by WebAIAssist, not by the page):';
export const BUILTIN_COMPACT_HEADING = 'Built-in (written by WebAIAssist, not by the page):';

const isBuiltin = (tool: ToolInfo): boolean => tool.builtin === true;

/** The tools that belong in the page section: everything but the built-in tool. */
export const pageTools = (tools: readonly ToolInfo[]): ToolInfo[] =>
  tools.filter((tool) => !isBuiltin(tool));

function line(tool: ToolInfo): string {
  return JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema ?? { type: 'object' },
    readOnly: tool.annotations?.readOnlyHint === true,
  });
}

/** The section of the full prompt, with a blank line before it, or '' when the tool is not offered. */
export function builtinSection(tools: readonly ToolInfo[]): string {
  const own = tools.filter(isBuiltin);
  if (own.length === 0) return '';
  return `\n\n${BUILTIN_HEADING}\n${own.map(line).join('\n')}\n${GRAPH_HINT}`;
}

/** One short entry for a small window. */
const COMPACT_HINT =
  "webaiassist_query_graph(sparql: string): read-only SPARQL (SELECT, ASK) over this node's graph; no argument lists classes and properties. " +
  'Prefixes asc: skos: dcterms:. Classes asc:Concept asc:Cluster asc:Source; properties skos:prefLabel skos:member.';

/** The lines of the compact prompt, or '' when the tool is not offered. */
export function builtinCompact(tools: readonly ToolInfo[]): string {
  return tools.some(isBuiltin) ? `${BUILTIN_COMPACT_HEADING}\n${COMPACT_HINT}` : '';
}
