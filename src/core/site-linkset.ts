// SPDX-License-Identifier: Apache-2.0
// Reads a link set (RFC 9264) such as an AgenticSystemCore node's /.well-known/knowledge-linkset
// or an API catalog (RFC 9727). The document must be an object whose only member is `linkset`,
// with one link context whose anchor is on the tab's own origin; anything else is not that
// site's document. Relation names are kept as written, unknown ones are ignored, nothing is
// fetched from it.
import { parseCounts } from './graph-files';
import { resolveAddress, type Address } from './site-url';

export const AGSC_PROFILE = 'https://w3id.org/agentic-system-core/profile/agentic-knowledge';
export const CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727';
const AGSC_REL = 'https://w3id.org/agentic-system-core/rel#';
const MAX_RELATIONS = 100;

export interface LinksetLink {
  /** `surface`, `skills`, `alternate`, `service-doc` ... (the AgenticSystemCore prefix is cut). */
  readonly rel: string;
  readonly href: string;
  readonly type?: string;
  readonly title?: string;
  /** The link points to the site's own origin; other hosts are shown as text only. */
  readonly sameOrigin: boolean;
  /** The `agsc-surface` value (`webmcp`, `llms-txt`, `chunks` ...). */
  readonly surface?: string;
}

export interface Linkset {
  readonly anchor: string;
  /** The named profile was found in the media type or in the Link header. */
  readonly profile: boolean;
  readonly links: readonly LinksetLink[];
  readonly specVersion?: string;
  readonly bundleVersion?: string;
  /** What the node says its graph holds (`agsc-counts`: clusters, concepts ...). */
  readonly counts?: Readonly<Record<string, number>>;
  /** The node's JSON-LD graph, when the linkset names it on the node's own origin. */
  readonly graphHref?: string;
  readonly restricted: boolean;
  readonly tombstone: boolean;
}

export type LinksetResult =
  | { readonly ok: true; readonly linkset: Linkset }
  | { readonly ok: false; readonly why: 'parse' | 'anchor' };

type Entry = Record<string, unknown>;
const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const firstText = (value: unknown): string | undefined =>
  Array.isArray(value) && typeof value[0] === 'string' ? value[0].slice(0, 200) : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, 200) : undefined;

/** True when `profile` is named by the media type's profile parameter or by a Link header. */
export function namesProfile(profile: string, contentType: string, link: string): boolean {
  const quoted = `profile="${profile}"`;
  if (contentType.replaceAll(' ', '').includes(quoted)) return true;
  return link.includes(`<${profile}>`) && /rel="?profile"?/.test(link);
}

function linkOf(rel: string, item: unknown, anchor: Address): LinksetLink | undefined {
  if (!isEntry(item) || typeof item.href !== 'string') return undefined;
  const target = resolveAddress(item.href, anchor.origin);
  if (!target) return undefined;
  const type = text(item.type);
  const title = text(item.title);
  const surface = firstText(item['agsc-surface']);
  return {
    rel: rel.startsWith(AGSC_REL) ? rel.slice(AGSC_REL.length) : rel,
    href: target.href.slice(0, 500),
    sameOrigin: target.origin === anchor.origin,
    ...(type === undefined ? {} : { type }),
    ...(title === undefined ? {} : { title }),
    ...(surface === undefined ? {} : { surface }),
  };
}

function linksOf(context: Entry, anchor: Address): LinksetLink[] {
  const out: LinksetLink[] = [];
  for (const [rel, items] of Object.entries(context)) {
    if (rel === 'anchor' || !Array.isArray(items)) continue;
    for (const item of items) {
      const found = linkOf(rel, item, anchor);
      if (found && out.length < MAX_RELATIONS) out.push(found);
    }
  }
  return out;
}

function contextOf(root: unknown): Entry | undefined {
  if (!isEntry(root) || Object.keys(root).length !== 1) return undefined;
  const list = root.linkset;
  return Array.isArray(list) && list.length === 1 && isEntry(list[0]) ? list[0] : undefined;
}

function described(context: Entry): Entry {
  const list = context.describedby;
  return Array.isArray(list) && isEntry(list[0]) ? list[0] : {};
}

/** The node's graph: its counts, and its address when it is on the node's own origin. */
function graphFacts(about: Entry, anchor: Address): Pick<Linkset, 'counts' | 'graphHref'> {
  const counts = parseCounts(Array.isArray(about['agsc-counts']) ? about['agsc-counts'] : []);
  const graph =
    typeof about.href === 'string' ? resolveAddress(about.href, anchor.origin) : undefined;
  return {
    ...(Object.keys(counts).length === 0 ? {} : { counts }),
    ...(graph?.origin === anchor.origin ? { graphHref: graph.href } : {}),
  };
}

export function parseLinkset(raw: string, origin: string, profile: boolean): LinksetResult {
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return { ok: false, why: 'parse' };
  }
  const context = contextOf(root);
  const anchor =
    typeof context?.anchor === 'string' ? resolveAddress(context.anchor, origin) : undefined;
  if (!context || !anchor) return { ok: false, why: 'parse' };
  if (anchor.origin !== origin) return { ok: false, why: 'anchor' };
  const about = described(context);
  const specVersion = firstText(about['agsc-spec-version']);
  const bundleVersion = firstText(about['agsc-bundle-version']);
  return {
    ok: true,
    linkset: {
      anchor: anchor.href,
      profile,
      links: linksOf(context, anchor),
      restricted: firstText(about['agsc-visibility']) === 'restricted',
      tombstone: firstText(about['agsc-tombstone']) !== undefined,
      ...(specVersion === undefined ? {} : { specVersion }),
      ...(bundleVersion === undefined ? {} : { bundleVersion }),
      ...graphFacts(about, anchor),
    },
  };
}
