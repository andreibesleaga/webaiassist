// SPDX-License-Identifier: Apache-2.0
// Reads the open node's graph.nq through the tab, for the query engine. The path is used only when the
// node's own linkset names it on this origin with a SHA-256 digest (the linkset can confirm a path,
// never choose one), and the bytes must match that digest, as for the explorer's graph.jsonld
// (graph-fetch-shim.ts). A graph that is cut, too big, of the wrong kind or different from its
// digest is refused whole: a partial graph would answer questions wrongly without saying so.
import { graphSpecOf, type GraphFileId } from '../core/graph-files';
import type { FileOutcome, Trouble } from '../core/site-files';
import type { TabFile } from './explorer-tab-reader';
import { digestMismatchText, troubleText } from './graph-fetch-guard';
import { declaredDigests } from './linkset-digests';

export type NodeFile = Extract<GraphFileId, 'graph-nq' | 'ontology'>;

export const GRAPH_PATH = graphSpecOf('graph-nq').path;

export type GraphLoad =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly digest: string }
  | { readonly ok: false; readonly text: string };

export interface GraphLoadDeps {
  readTab(spec: TabFile): Promise<FileOutcome>;
  /** The base64 SHA-256 of the bytes. */
  sha256(bytes: Uint8Array): Promise<string>;
}

export const NOT_A_NODE =
  'This site does not publish a graph at the standard place that WebAIAssist may read.';

export const NO_VOCABULARY =
  'This node does not publish its vocabulary at the standard place that WebAIAssist may read.';

const failed = (text: string): GraphLoad => ({ ok: false, text });
const trouble = (path: string, why: Trouble): string => `${path} ${troubleText(why)}.`;

/** The digest the linkset declares for a file of this origin, or undefined. */
export async function declaredDigest(
  deps: Pick<GraphLoadDeps, 'readTab'>,
  origin: string,
  file: NodeFile,
): Promise<string | undefined> {
  const outcome = await deps.readTab('linkset').catch(() => undefined);
  if (outcome?.state !== 'found') return undefined;
  return declaredDigests(outcome.text, origin).get(`${origin}${graphSpecOf(file).path}`);
}

/** graph.nq (or the vocabulary file) of the open node, as bytes, checked against its declared digest. */
export async function loadNodeFile(
  deps: GraphLoadDeps,
  origin: string,
  file: NodeFile = 'graph-nq',
): Promise<GraphLoad> {
  const path = graphSpecOf(file).path;
  const declared = await declaredDigest(deps, origin, file);
  if (declared === undefined) return failed(file === 'graph-nq' ? NOT_A_NODE : NO_VOCABULARY);
  const outcome = await deps.readTab(file).catch(() => undefined);
  if (outcome === undefined) return failed(trouble(path, 'network'));
  if (outcome.state === 'not-published') return failed(`${path} is not published.`);
  if (outcome.state !== 'found') return failed(trouble(path, outcome.why));
  const bytes = new TextEncoder().encode(outcome.text);
  const actual = outcome.sha256 ?? (await deps.sha256(bytes));
  if (actual !== declared) return failed(digestMismatchText(path, new URL(origin).host));
  return { ok: true, bytes, digest: actual };
}
