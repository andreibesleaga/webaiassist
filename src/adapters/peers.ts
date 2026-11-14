// SPDX-License-Identifier: Apache-2.0
// Which other nodes the explorer may offer to read. The linkset of the open node names its
// peers; they are other sites, so nothing is read from them until the user ticks them. Only an
// https origin with a public host name qualifies: no IP address, no local name, no other port,
// no user info. The rules are the same ones the fetch guard applies (graph-fetch-guard.ts).
import type { LinksetLink } from '../core/site-linkset';

export type PeerRefusal =
  'invalid' | 'not-https' | 'user-info' | 'port' | 'ip' | 'local' | 'no-dot';

export type PeerCheck =
  | { readonly ok: true; readonly origin: string }
  | { readonly ok: false; readonly why: PeerRefusal };

export interface PeerChoice {
  /** The origin as the linkset names it, in normal form. */
  readonly origin: string;
  readonly allowed: boolean;
  readonly why?: PeerRefusal;
}

/** At most this many peers are listed (the explorer's own limit is 16, too). */
export const MAX_PEERS = 16;

const LOCAL_SUFFIX = /\.(localhost|local|internal|lan|home\.arpa)$/;
const PUBLIC_NAME = /^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/;

function hostProblem(host: string): PeerRefusal | undefined {
  if (host.startsWith('[') || /^[\d.]+$/.test(host)) return 'ip';
  if (host === 'localhost' || LOCAL_SUFFIX.test(host)) return 'local';
  return PUBLIC_NAME.test(host) ? undefined : 'no-dot';
}

function schemeProblem(url: URL): PeerRefusal | undefined {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'not-https';
  if (url.username !== '' || url.password !== '') return 'user-info';
  if (url.protocol === 'http:') return 'not-https';
  return url.port === '' ? undefined : 'port';
}

/** The origin in normal form (lower case, no trailing dot), or the reason it cannot be a peer. */
export function isAllowedPeerOrigin(input: string): PeerCheck {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, why: 'invalid' };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const why = schemeProblem(url) ?? hostProblem(host);
  return why ? { ok: false, why } : { ok: true, origin: `https://${host}` };
}

/** The origin of an address in a peer link: normal form when allowed, else as written. */
function originFor(href: string): { origin: string; check: PeerCheck } | undefined {
  try {
    const url = new URL(href);
    const check = isAllowedPeerOrigin(href);
    return { origin: check.ok ? check.origin : url.origin, check };
  } catch {
    return undefined;
  }
}

/** The peers a node's linkset names, once each, without the node itself, at most 16. */
export function peerChoices(links: readonly LinksetLink[], tabOrigin: string): PeerChoice[] {
  const own = isAllowedPeerOrigin(tabOrigin);
  const choices: PeerChoice[] = [];
  const seen = new Set<string>([own.ok ? own.origin : tabOrigin]);
  for (const link of links) {
    const found = link.rel === 'peer' ? originFor(link.href) : undefined;
    if (!found || seen.has(found.origin) || choices.length >= MAX_PEERS) continue;
    seen.add(found.origin);
    choices.push(
      found.check.ok
        ? { origin: found.origin, allowed: true }
        : { origin: found.origin, allowed: false, why: found.check.why },
    );
  }
  return choices;
}
