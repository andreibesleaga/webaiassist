// SPDX-License-Identifier: Apache-2.0
// The one decision that keeps the explorer page on a short leash. The site's explorer code calls
// fetch with addresses it builds from the node's own linkset; this function judges each address
// before anything is sent. Own files (the tab's origin and a fixed path) are read through the tab;
// a peer is read only when the user ticked its origin; everything else is refused. The page
// can never choose an address that is not in the fixed list below. No browser API here.
import { isAllowedPeerOrigin } from './peers';
import type { GraphFileId } from '../core/graph-files';
import type { Trouble } from '../core/site-files';

export type GuardedFile = 'linkset' | Extract<GraphFileId, 'graph-jsonld' | 'chunks'>;

/** The three files the explorer reads, from the node and from a ticked peer. */
export const EXPLORER_PATHS: Readonly<Record<string, GuardedFile>> = {
  '/.well-known/knowledge-linkset': 'linkset',
  '/graph.jsonld': 'graph-jsonld',
  '/chunks.jsonl': 'chunks',
};

export type RefusalReason = 'bad-address' | 'not-fixed' | 'not-ticked' | 'peer-rules';

export interface GuardState {
  readonly tabOrigin: string;
  /** Peer origins the user ticked, in normal form (peers.ts). */
  readonly approved: ReadonlySet<string>;
}

export type Decision =
  | { readonly kind: 'tab'; readonly path: string; readonly spec: GuardedFile }
  | { readonly kind: 'peer'; readonly url: string; readonly spec: GuardedFile }
  | { readonly kind: 'refuse'; readonly why: RefusalReason };

const refuse = (why: RefusalReason): Decision => ({ kind: 'refuse', why });

function parse(address: string): URL | undefined {
  try {
    return new URL(address);
  } catch {
    return undefined;
  }
}

/** Plain sentences for the status line of the explorer; the copied code shows them as they are. */
export function refusalText(why: RefusalReason): string {
  const text: Record<RefusalReason, string> = {
    'bad-address': 'WebAIAssist does not read that address.',
    'not-fixed': 'This file is not on WebAIAssist’s fixed list of files it reads from a node.',
    'not-ticked':
      'WebAIAssist reads only this node and the nodes you tick. That node is not ticked, so it was not read.',
    'peer-rules':
      'WebAIAssist reads a node only over https, from a public name, on the usual port.',
  };
  return text[why];
}

function judgePeer(url: URL, state: GuardState): Decision {
  const check = isAllowedPeerOrigin(url.href);
  if (!check.ok) return refuse('peer-rules');
  if (!state.approved.has(check.origin)) return refuse('not-ticked');
  const spec = EXPLORER_PATHS[url.pathname];
  return spec ? { kind: 'peer', url: url.href, spec } : refuse('not-fixed');
}

/** Judges one address the explorer asks for. */
export function decide(address: string, state: GuardState): Decision {
  const url = parse(address);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return refuse('bad-address');
  if (url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
    return refuse('bad-address');
  }
  if (url.origin.toLowerCase() === state.tabOrigin.toLowerCase()) {
    const spec = EXPLORER_PATHS[url.pathname];
    return spec ? { kind: 'tab', path: url.pathname, spec } : refuse('not-fixed');
  }
  return judgePeer(url, state);
}

/** Why a file read through the tab gave nothing, in a plain sentence (after the file's name). */
export function troubleText(why: Trouble): string {
  const text: Record<Trouble, string> = {
    timeout: 'no answer in 5 seconds',
    network: 'could not be read',
    server: 'the site answered with an error',
    denied: 'the site refused the request',
    type: 'is not the kind of file expected (a page instead of data)',
    size: 'is larger than WebAIAssist reads, so it was not read',
    parse: 'the answer could not be checked',
  };
  return text[why];
}

/** The sentence for a file whose bytes do not match the SHA-256 digest its node published. */
export function digestMismatchText(path: string, host: string): string {
  return `${path} on ${host} does not match the SHA-256 digest that the node published for it, so it is not drawn.`;
}
