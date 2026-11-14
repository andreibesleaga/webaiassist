// SPDX-License-Identifier: Apache-2.0
// Node mode: an AgenticSystemCore node page registers ten known tools and links to its
// /.well-known/knowledge-linkset. When either is seen, the system prompt adds a short
// hint on the roles of those tools. The page only says it is a node: the hint names roles and
// makes no claim about what the tools do.

/** The ten tools a node page registers through WebMCP. */
export const AGSC_TOOL_NAMES: readonly string[] = [
  'ask',
  'brief',
  'check',
  'compose',
  'explain',
  'links',
  'propose',
  'read',
  'remember',
  'search',
];

export interface PageSignals {
  /** The page links to /.well-known/knowledge-linkset. */
  readonly linkset?: boolean;
  readonly toolNames: readonly string[];
}

export function isAgscNode(page: PageSignals): boolean {
  if (page.linkset === true) return true;
  const names = new Set(page.toolNames);
  return AGSC_TOOL_NAMES.every((name) => names.has(name));
}

export const NODE_HINT = [
  'This page says it is an AgenticSystemCore node: a catalogue of items linked to each other.',
  'The roles of its tools, as such a node names them:',
  'search finds items, read gives one item by its slug, links lists its links,',
  'ask gives the best-matching item descriptions, explain says why two items are linked,',
  'compose, brief and check take a selection of item slugs,',
  'propose and remember return a payload that the user can export from the panel.',
  'The site writes these tools; the extension has not checked what they do.',
].join('\n');

/** The same hint in one line, for runtimes with a small context window. */
export const NODE_HINT_SHORT =
  'The site says it is an AgenticSystemCore node: search finds items, read takes a slug, ' +
  'links lists links, propose and remember return a payload to export.';
