// SPDX-License-Identifier: Apache-2.0
// What the open page says about itself: JSON-LD blocks, Open Graph and meta tags, as the
// isolated page script read them from the live page (no request). JSON-LD is parsed here and
// only a handful of text members are kept; no `@context`, `@id` or `url` is ever fetched.

/** Raw page data, capped in the page before it comes here (site-page-script.ts). */
export interface PageMeta {
  readonly title: string;
  readonly language?: string;
  readonly description?: string;
  readonly og: {
    readonly title?: string;
    readonly description?: string;
    readonly type?: string;
    readonly siteName?: string;
  };
  readonly jsonLd: readonly string[];
  /** `<link rel=... href=... type=...>` of the kinds the panel knows. */
  readonly links: readonly {
    readonly rel: string;
    readonly href: string;
    readonly type?: string;
  }[];
  /** `<meta name="tdm-reservation">`: "0" or "1". */
  readonly tdm?: string;
}

export interface PageFact {
  readonly source: 'JSON-LD' | 'Open Graph' | 'meta';
  readonly type?: string;
  readonly title?: string;
  readonly description?: string;
  readonly date?: string;
  readonly license?: string;
  readonly language?: string;
}

type Entry = Record<string, unknown>;
const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const cut = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, 300) : undefined;

function typeOf(node: Entry): string | undefined {
  const type = node['@type'];
  return cut(Array.isArray(type) ? type[0] : type);
}

function nodesOf(raw: string): Entry[] {
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isEntry(root)) return [];
  const graph = root['@graph'];
  return Array.isArray(graph) ? [root, ...graph.filter(isEntry)] : [root];
}

function licenseOf(node: Entry): string | undefined {
  const value = node.license;
  return cut(isEntry(value) ? (value['@id'] ?? value.url) : value);
}

function factOf(node: Entry, language: string | undefined): PageFact | undefined {
  const type = typeOf(node);
  const title = cut(node.name) ?? cut(node.headline);
  if (type === undefined || title === undefined) return undefined;
  const fields = {
    type,
    title,
    description: cut(node.description),
    date: cut(node.dateModified) ?? cut(node.datePublished),
    license: licenseOf(node),
    language: cut(node.inLanguage) ?? language,
  };
  const defined = Object.entries(fields).filter(([, value]) => value !== undefined);
  return { source: 'JSON-LD', ...Object.fromEntries(defined) };
}

function fromJsonLd(meta: PageMeta): PageFact | undefined {
  for (const raw of meta.jsonLd) {
    for (const node of nodesOf(raw)) {
      const fact = factOf(node, meta.language);
      if (fact) return fact;
    }
  }
  return undefined;
}

function fromOpenGraph(meta: PageMeta): PageFact | undefined {
  const title = cut(meta.og.title);
  if (title === undefined) return undefined;
  const description = cut(meta.og.description);
  const type = cut(meta.og.type);
  return {
    source: 'Open Graph',
    title,
    ...(description === undefined ? {} : { description }),
    ...(type === undefined ? {} : { type }),
  };
}

function fromMeta(meta: PageMeta): PageFact | undefined {
  const description = cut(meta.description);
  if (description === undefined) return undefined;
  return { source: 'meta', title: cut(meta.title) ?? '', description };
}

/** The best source in this order: JSON-LD, Open Graph, the description meta tag. */
export function pageFact(meta: PageMeta): PageFact | undefined {
  return fromJsonLd(meta) ?? fromOpenGraph(meta) ?? fromMeta(meta);
}
