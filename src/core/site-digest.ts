// SPDX-License-Identifier: Apache-2.0
// The node's own list of digests. A knowledge link set gives each target a digest in the syntax
// of RFC 9530 (`sha-256=:BASE64:`). For a file the extension read, the page script computed the
// SHA-256 of the raw bytes; here it is compared with the list. This shows only that the file is
// the one the node's own list names: the same site publishes both, so it is not a proof of who
// wrote it. A file that does not match is not given to the model (site-facts.ts).
import type { SiteFileId } from './site-files';
import { SITE_FILES } from './site-files';
import type { Outcomes } from './site-facts';
import type { Linkset } from './site-linkset';
import { resolveAddress } from './site-url';

export interface DigestCheck {
  /** Files whose bytes match the node's list. */
  readonly matched: readonly SiteFileId[];
  /** Files the node lists with a digest that is different. */
  readonly mismatched: readonly SiteFileId[];
}

const SHA256 = /^sha-256=:([A-Za-z0-9+/]+={0,2}):$/;

/** The base64 of the sha-256 entry of a `digest` list; undefined when there is none. */
export function parseDigest(list: readonly string[] | string | undefined): string | undefined {
  if (!Array.isArray(list)) return undefined;
  for (const entry of list as string[]) {
    const match = SHA256.exec(entry);
    if (match) return match[1];
  }
  return undefined;
}

/** The digest the list gives for one fixed path on the node's own origin. */
function listedDigest(set: Linkset, origin: string, path: string): string | undefined {
  for (const link of set.links) {
    const target = resolveAddress(link.href, origin);
    if (!link.sameOrigin || target?.origin !== origin) continue;
    if (target.href !== `${origin}${path}`) continue;
    const digest = parseDigest(link.digest);
    if (digest !== undefined) return digest;
  }
  return undefined;
}

/** Compares each file that was read and listed. A file with no computed digest is skipped. */
export function checkDigests(set: Linkset, outcomes: Outcomes, origin: string): DigestCheck {
  const matched: SiteFileId[] = [];
  const mismatched: SiteFileId[] = [];
  for (const spec of SITE_FILES) {
    const outcome = outcomes[spec.id];
    const own = outcome?.state === 'found' ? outcome.sha256 : undefined;
    const listed = listedDigest(set, origin, spec.path);
    if (own === undefined || listed === undefined) continue;
    (own === listed ? matched : mismatched).push(spec.id);
  }
  return { matched, mismatched };
}
