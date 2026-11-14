// SPDX-License-Identifier: Apache-2.0
// The files of a node's knowledge graph, and what the linkset says about them. This list is
// separate from the eight site files (site-files.ts): the explorer tab reads these through the
// open tab, like the site files, and only for a path the node's own linkset names. Every
// address is the tab's origin plus a path below; a path that comes from a file is never used.
// "json: true" in a spec means: a file that was cut is dropped whole (checkReply), for the
// two JSON files and for the line formats too, because a cut graph would be a silent partial one.
import type { SiteFileSpec } from './site-files';

export type GraphFileId = 'graph-jsonld' | 'graph-nq' | 'chunks' | 'ontology';

/** The part of a site-file spec that checkReply needs, plus the id of this list. */
export type GraphFileSpec = Pick<SiteFileSpec, 'accept' | 'json' | 'maxBytes' | 'path'> & {
  readonly id: GraphFileId;
};

const MIB = 1024 * 1024;

export const STANDARD_GRAPH_PATH = '/graph.jsonld';

export const GRAPH_FILES: readonly GraphFileSpec[] = [
  {
    id: 'graph-jsonld',
    path: STANDARD_GRAPH_PATH,
    accept: ['application/ld+json', 'application/json'],
    maxBytes: 2 * MIB,
    json: true,
  },
  {
    id: 'graph-nq',
    path: '/graph.nq',
    accept: ['application/n-quads', 'text/plain', 'application/octet-stream'],
    maxBytes: 4 * MIB,
    json: true,
  },
  {
    id: 'chunks',
    path: '/chunks.jsonl',
    accept: ['application/jsonl', 'application/x-ndjson', 'text/plain'],
    maxBytes: 2 * MIB,
    json: true,
  },
  {
    id: 'ontology',
    path: '/ns/agsc.ttl',
    accept: ['text/turtle', 'text/plain'],
    maxBytes: 1 * MIB,
    json: true,
  },
];

export const graphSpecOf = (id: GraphFileId): GraphFileSpec => {
  const spec = GRAPH_FILES.find((item) => item.id === id);
  if (!spec) throw new Error(`unknown graph file ${id}`);
  return spec;
};

const MAX_COUNTS = 20;
const MAX_COUNT = 10_000_000;

/** `["clusters=3", "concepts=13"]` -> `{ clusters: 3, concepts: 13 }`; anything else is ignored. */
export function parseCounts(list: readonly unknown[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!Array.isArray(list)) return counts;
  for (const item of list.slice(0, MAX_COUNTS)) {
    const match = typeof item === 'string' ? /^([a-z][a-z0-9-]{0,30})=(\d{1,8})$/.exec(item) : null;
    const value = Number(match?.[2]);
    if (match?.[1] !== undefined && value <= MAX_COUNT) counts[match[1]] = value;
  }
  return counts;
}

/** The items the node says its graph holds: the sum of its counts; undefined when it gives none. */
export function graphItemCount(
  counts: Readonly<Record<string, number>> | undefined,
): number | undefined {
  const values = Object.values(counts ?? {});
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0);
}
