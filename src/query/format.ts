// SPDX-License-Identifier: Apache-2.0
// Results written as short text for the model, and the names used to write terms. The terms come from
// the site's own view code (third_party/agsc-query/view.js `queryTermText`: prefixed names where one
// of the node's prefixes covers an address). Everything here is node-author text; the caller fences it.
import { queryTermText } from '../../third_party/agsc-query/view.js';
import { QUERY_LIMITS } from './protocol';

/** The prefixes of a node's graph and of the query page of the site (`asc` ... `xsd`, and `rdf`), and `owl` for the vocabulary. */
export const PREFIXES: Readonly<Record<string, string>> = {
  asc: 'https://w3id.org/agentic-system-core/ns#',
  dcterms: 'http://purl.org/dc/terms/',
  prov: 'http://www.w3.org/ns/prov#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  schema: 'https://schema.org/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  owl: 'http://www.w3.org/2002/07/owl#',
};

interface JsonResults {
  head?: { vars?: string[] };
  results?: { bindings: Record<string, unknown>[] };
  boolean?: boolean;
}

export interface Limits {
  readonly rows: number;
  readonly chars: number;
}

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The text of one result row: its values, tab-separated, each on one line. */
const rowLine = (row: Record<string, unknown>, vars: readonly string[]): string =>
  vars.map((name) => oneLine(queryTermText(row[name], PREFIXES))).join('\t');

/** The rows that fit the limits, after the header line, and how many were left out of `total`. */
function fitRows(
  header: string,
  bindings: readonly Record<string, unknown>[],
  vars: readonly string[],
  limits: Limits,
): string[] {
  const lines = [header];
  let used = header.length;
  for (const row of bindings.slice(0, limits.rows)) {
    const line = rowLine(row, vars);
    if (used + line.length + 1 > limits.chars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines;
}

/** The result as a header line and tab-separated rows, within the limits; or the ASK answer. */
export function rowsText(json: string, total: number, limits: Limits): string {
  const result = JSON.parse(json) as JsonResults;
  if (typeof result.boolean === 'boolean') return `ASK answered ${result.boolean ? 'yes' : 'no'}.`;
  const vars = result.head?.vars ?? [];
  const bindings = result.results?.bindings ?? [];
  if (bindings.length === 0) return 'No rows.';
  const lines = fitRows(vars.map((name) => `?${name}`).join('\t'), bindings, vars, limits);
  const rest = Math.max(total, bindings.length) - (lines.length - 1);
  return (rest > 0 ? [...lines, `[cut: ${rest} more rows]`] : lines).join('\n');
}

/** The three fixed queries behind the summary the model gets when it calls the tool without one. */
export const SUMMARY_QUERIES = {
  classes:
    'SELECT ?class (COUNT(?s) AS ?n) WHERE { ?s a ?class } GROUP BY ?class ORDER BY DESC(?n) LIMIT 25',
  properties:
    'SELECT ?property (COUNT(*) AS ?n) WHERE { ?s ?property ?o } GROUP BY ?property ORDER BY DESC(?n) LIMIT 25',
  sample: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 3',
} as const;

export interface SummaryParts {
  readonly classes: string;
  readonly properties: string;
  readonly sample: string;
}

/** The summary as one text: classes, properties, a sample; at most 25 lines and 1,500 characters. */
export function summaryText(parts: SummaryParts): string {
  const section = (title: string, body: string, lines: number, chars: number): string =>
    `${title}\n${body.split('\n').slice(0, lines).join('\n').slice(0, chars)}`;
  return [
    section('Classes (class, count):', parts.classes, 6, 500),
    section('Properties (property, count):', parts.properties, 13, 750),
    section('Sample statements:', parts.sample, 3, 150),
  ]
    .join('\n')
    .slice(0, QUERY_LIMITS.summaryChars);
}
