// SPDX-License-Identifier: Apache-2.0
// The one tool that WebAIAssist offers its model itself: a read-only question to the open node's
// published knowledge graph. It is not a page tool, so a page must not be able to take its place:
// - it is listed apart, under its own heading (prompt.ts), written here and not by the page;
// - every page tool whose name is, or looks like, a name of WebAIAssist is dropped before the model
//   sees the list (isReservedName, mergeTools), so a call by name can only meet this one;
// - the card marks the dropped tools (tool-card.ts).
// No browser API here.
import type { ToolInfo } from './types';

export const QUERY_TOOL_NAME = 'webaiassist_query_graph';
/** Names that start like this are WebAIAssist's. */
export const RESERVED_PREFIX = 'webaiassist';

/** The longest query the model may send; the engine side allows more (src/query/protocol.ts). */
export const QUERY_TOOL_CHARS = 1500;

export const QUERY_TOOL: ToolInfo = {
  name: QUERY_TOOL_NAME,
  description:
    "Ask this node's published knowledge graph a read-only SPARQL query (SELECT or ASK). " +
    'Call it with no arguments to get the classes and properties. ' +
    'Use it for counts, lists and links between items that the page tools cannot give.',
  inputSchema: {
    type: 'object',
    properties: { sparql: { type: 'string', maxLength: QUERY_TOOL_CHARS } },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  builtin: true,
};

/** Letters of other alphabets that look like a Latin letter of "webaiassist" (and the rest of a name). */
const CONFUSABLE: Readonly<Record<string, string>> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  і: 'i',
  ѕ: 's',
  ј: 'j',
  ԁ: 'd',
  ԝ: 'w',
  һ: 'h',
  ӏ: 'l',
  ο: 'o',
  ι: 'i',
  α: 'a',
  ε: 'e',
  ν: 'v',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  κ: 'k',
  β: 'b',
  ɑ: 'a',
  ı: 'i',
};

/** A name as it reads to a person: compatibility forms folded, case dropped, look-alike letters
 *  mapped, everything that is not an ASCII letter or digit removed. */
function foldedName(name: string): string {
  const lower = name.normalize('NFKC').toLowerCase();
  let out = '';
  for (const char of lower) out += CONFUSABLE[char] ?? char;
  return out.replace(/[^a-z0-9]/g, '');
}

/** True for a name that is, or reads like, one of WebAIAssist's own tool names. */
export function isReservedName(name: string): boolean {
  return foldedName(name).startsWith(RESERVED_PREFIX);
}

export interface MergedTools {
  readonly tools: readonly ToolInfo[];
  /** Page tools that were left out because of their name, as the page wrote them. */
  readonly reserved: readonly string[];
}

/** The page's tools without any reserved name, then the built-in tool (once) when it is offered. */
export function mergeTools(
  pageTools: readonly ToolInfo[],
  builtin: ToolInfo | undefined,
): MergedTools {
  const reserved: string[] = [];
  const tools: ToolInfo[] = [];
  for (const tool of pageTools) {
    if (tool.builtin === true || isReservedName(tool.name)) reserved.push(tool.name);
    else tools.push(tool);
  }
  return { tools: builtin ? [...tools, builtin] : tools, reserved };
}

/** What the model is told after a query failed, once, and then after a second failure. */
export const REPAIR_NOTE = 'Fix the query once and call the tool again, or answer without it.';
export const STOP_NOTE =
  'The query failed twice. Answer from what you have, or say you could not run it.';

/** The text of a failed run with the instruction for the next step (the first failure repairs). */
export function failureText(error: string, failuresSoFar: number): string {
  return `${error}\n${failuresSoFar <= 1 ? REPAIR_NOTE : STOP_NOTE}`;
}

/**
 * A short hint on the graph of a node, for the system prompt. Verified by a test against the
 * graph.nq files of both live nodes: every name below occurs there and the example query returns
 * rows on both.
 */
export const GRAPH_HINT = [
  `Built-in tool ${QUERY_TOOL_NAME}: SPARQL over this node's graph. Prefixes asc:, skos:, dcterms:, rdfs:, schema:, xsd:.`,
  'Classes: asc:Concept, asc:Cluster, asc:Source, asc:Procedure. A class is the object of "a".',
  'Properties: skos:prefLabel, skos:definition, skos:member (cluster to item), skos:inScheme, asc:source, dcterms:source, asc:grade.',
  'Example: SELECT ?c ?name WHERE { ?c a asc:Cluster . ?c skos:prefLabel ?name } LIMIT 10',
].join('\n');

/** The example in GRAPH_HINT, for the test that runs it. */
export const GRAPH_HINT_EXAMPLE =
  'SELECT ?c ?name WHERE { ?c a asc:Cluster . ?c skos:prefLabel ?name } LIMIT 10';
