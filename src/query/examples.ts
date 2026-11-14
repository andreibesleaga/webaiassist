// SPDX-License-Identifier: Apache-2.0
// The questions the Query tab offers: the site's first query and the ten questions of the node
// vocabulary (third_party/agsc-query/ontology-questions.json, copied unchanged). "Put in editor"
// writes one into the editor with the prefix lines in front; it never runs it.
import questions from '../../third_party/agsc-query/ontology-questions.json';

export interface Example {
  readonly number: number;
  readonly question: string;
  /** What the placeholder in the query stands for ("slug X"), or empty when there is none. */
  readonly subject: string;
  /** The query text with its prefix lines. */
  readonly sparql: string;
  /** The query holds a placeholder the user must replace before it can run. */
  readonly needsEdit: boolean;
}

/** Prefix lines of the file's own list ("asc: <https://...>"), as written in a query. */
const PREFIX_LINES = `${questions.prefixes.map((line) => `PREFIX ${line}`).join('\n')}\n`;

/** The query in the editor when the tab opens: every item with its name (the site's own first query). */
export const FIRST_QUERY =
  'PREFIX skos: <http://www.w3.org/2004/02/skos/core#>\n' +
  'SELECT ?item ?name WHERE { ?item skos:prefLabel ?name } ORDER BY ?item LIMIT 100\n';

export const EXAMPLES: readonly Example[] = questions.questions.map((item) => ({
  number: item.number,
  question: item.question,
  subject: item.subject,
  sparql: `${PREFIX_LINES}${item.sparql}\n`,
  needsEdit: item.sparql.includes('<S...>') || /\bX\b/.test(item.subject),
}));
