// SPDX-License-Identifier: Apache-2.0
// The Vocabulary tab: the classes and properties the node says it uses, read from its published
// vocabulary file into a store of its own (never mixed with the graph the Query tab asks), and the
// vocabulary files the node's linkset names on its own address, each with an Open button. Loaded when
// the tab is first shown. Text only.
import { namesProfile, parseLinkset, type LinksetLink } from '../../core/site-linkset';
import { visible } from '../../core/tool-card';
import { PREFIXES } from '../../query/format';
import { QUERY_LIMITS } from '../../query/protocol';
import { element } from '../dom';
import { t } from '../i18n';
import type { MessageKey } from '../messages-en';
import { queryTermText } from '../../../third_party/agsc-query/view.js';
import { onFirstShow } from './first-show';
import { openInNewTab } from './link-opener';
import type { ExplorerContext, ExplorerTab, QueryTabDeps } from './tabs';

const OWL = 'http://www.w3.org/2002/07/owl#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';

export const CLASSES_QUERY =
  `SELECT ?iri ?label ?comment WHERE { ?iri a <${OWL}Class> . ` +
  `OPTIONAL { ?iri <${RDFS}label> ?label } OPTIONAL { ?iri <${RDFS}comment> ?comment } } ORDER BY ?iri`;
export const PROPERTIES_QUERY =
  `SELECT ?iri ?label ?domain ?range WHERE { ?iri a ?kind . ` +
  `VALUES ?kind { <${OWL}ObjectProperty> <${OWL}DatatypeProperty> } ` +
  `OPTIONAL { ?iri <${RDFS}label> ?label } OPTIONAL { ?iri <${RDFS}domain> ?domain } ` +
  `OPTIONAL { ?iri <${RDFS}range> ?range } } ORDER BY ?iri`;

interface Binding {
  readonly [variable: string]: unknown;
}

function cell(doc: Document, row: Binding, name: string): HTMLTableCellElement {
  const text = visible(queryTermText(row[name], PREFIXES)).slice(0, 300);
  return element(doc, 'td', text);
}

type Column = readonly [name: string, label: string];

function table(doc: Document, title: string, columns: readonly Column[], json: string) {
  const section = element(doc, 'section');
  const head = element(doc, 'tr');
  for (const [, label] of columns) {
    const th = element(doc, 'th', label);
    th.scope = 'col';
    head.append(th);
  }
  const body = element(doc, 'tbody');
  const rows = (JSON.parse(json) as { results: { bindings: Binding[] } }).results.bindings;
  for (const row of rows) {
    const tr = element(doc, 'tr');
    for (const [name] of columns) tr.append(cell(doc, row, name));
    body.append(tr);
  }
  const out = element(doc, 'table', undefined, 'query-table');
  const thead = element(doc, 'thead');
  thead.append(head);
  out.append(element(doc, 'caption', title), thead, body);
  section.append(element(doc, 'h3', title), out);
  return section;
}

async function ask(deps: QueryTabDeps, text: string): Promise<string | undefined> {
  const outcome = await deps.vocabulary.run(text, { maxRows: 1000, ms: QUERY_LIMITS.tabMs });
  return outcome.kind === 'answer' ? outcome.reply.json : undefined;
}

/** Same-origin links of the node that are vocabulary: its ontology and its context file. */
export function vocabularyLinks(links: readonly LinksetLink[]): LinksetLink[] {
  return links.filter((link) => link.sameOrigin && ['ontology', 'context'].includes(link.rel));
}

function fileList(doc: Document, links: readonly LinksetLink[]): HTMLElement {
  const section = element(doc, 'section');
  section.append(element(doc, 'h3', t('vocabFiles')));
  if (links.length === 0) {
    section.append(element(doc, 'p', t('vocabNoFiles'), 'muted'));
    return section;
  }
  const list = element(doc, 'ul');
  for (const link of links) {
    const name = visible(new URL(link.href).pathname).slice(0, 120);
    const button = element(doc, 'button', t('vocabOpen'));
    button.type = 'button';
    button.setAttribute('aria-label', t('vocabOpenLabel', { name }));
    button.addEventListener('click', () => openInNewTab(link.href));
    const item = element(doc, 'li');
    item.append(element(doc, 'code', name), ' ', button);
    list.append(item);
  }
  section.append(list);
  return section;
}

async function linksOf(ctx: ExplorerContext): Promise<LinksetLink[]> {
  const outcome = await ctx.readTab('linkset').catch(() => undefined);
  if (outcome?.state !== 'found') return [];
  const profile = namesProfile(
    'https://w3id.org/agentic-system-core/profile/agentic-knowledge',
    outcome.contentType,
    outcome.link,
  );
  const parsed = parseLinkset(outcome.text, ctx.target.origin, profile);
  return parsed.ok ? vocabularyLinks(parsed.linkset.links) : [];
}

function columns(...keys: readonly (readonly [string, MessageKey])[]): Column[] {
  return keys.map(([name, key]) => [name, t(key)]);
}

async function fill(root: HTMLElement, ctx: ExplorerContext, deps: QueryTabDeps): Promise<void> {
  const status = element(ctx.doc, 'p', t('vocabLoading'), 'muted');
  status.setAttribute('role', 'status');
  root.append(status);
  const ready = await deps.vocabulary.ready();
  const links = await linksOf(ctx);
  if (!ready.ok) {
    status.textContent = ready.text;
  } else {
    const [classes, properties] = await Promise.all([
      ask(deps, CLASSES_QUERY),
      ask(deps, PROPERTIES_QUERY),
    ]);
    status.remove();
    if (classes !== undefined) {
      const cols = columns(
        ['iri', 'vocabColumnIri'],
        ['label', 'vocabColumnLabel'],
        ['comment', 'vocabColumnComment'],
      );
      root.append(table(ctx.doc, t('vocabClasses'), cols, classes));
    }
    if (properties !== undefined) {
      const cols = columns(
        ['iri', 'vocabColumnIri'],
        ['label', 'vocabColumnLabel'],
        ['domain', 'vocabColumnDomain'],
        ['range', 'vocabColumnRange'],
      );
      root.append(table(ctx.doc, t('vocabProperties'), cols, properties));
    }
  }
  root.append(fileList(ctx.doc, links));
}

export const vocabTab: ExplorerTab = {
  id: 'vocab',
  labelKey: 'explorerTabVocab',
  mount: (root, ctx) => {
    const deps = ctx.query;
    if (!deps) return;
    root.append(
      element(ctx.doc, 'h2', t('vocabHeading')),
      element(ctx.doc, 'p', t('vocabIntro'), 'muted'),
    );
    onFirstShow(root, () => void fill(root, ctx, deps));
  },
};
