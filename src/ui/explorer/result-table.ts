// SPDX-License-Identifier: Apache-2.0
// Turns the site's result view (third_party/agsc-query/view.js `queryTable`: a tree of
// [tag, attributes, ...children]) into DOM. Every text goes in as a text node, so no value of a graph
// can become markup or a script; only the few tags and attributes the view writes are accepted.
import { queryTable } from '../../../third_party/agsc-query/view.js';
import { PREFIXES } from '../../query/format';

const TAGS = new Set(['table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td', 'p']);
const ATTRIBUTES = new Set(['scope', 'class']);

type Tree = readonly [string, Readonly<Record<string, string>>, ...unknown[]];

function build(doc: Document, node: Tree, caption: string | undefined): HTMLElement {
  const [tag, attributes, ...children] = node;
  if (!TAGS.has(tag)) throw new Error(`WebAIAssist: the result view has the tag ${tag}`);
  const out = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (ATTRIBUTES.has(name)) out.setAttribute(name, value);
  }
  if (tag === 'caption' && caption !== undefined) {
    out.append(caption);
    return out;
  }
  for (const child of children) {
    out.append(typeof child === 'string' ? child : build(doc, child as Tree, caption));
  }
  return out;
}

/** The table of a result in the W3C JSON results format (or the sentence of an ASK answer). */
export function renderResult(
  doc: Document,
  json: string,
  rowsShown: number,
  caption: string | undefined,
): HTMLElement {
  return build(doc, queryTable(JSON.parse(json), rowsShown, PREFIXES), caption);
}
