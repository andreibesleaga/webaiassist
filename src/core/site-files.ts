// SPDX-License-Identifier: Apache-2.0
// The files a site may publish for machines, and how a reply for one is judged. The list is
// fixed: the extension builds every address from the open tab's origin and a path below, and
// never from a page or from a file (docs/THREAT-MODEL.md, "Site files"). No browser API here.

export type SiteFileId =
  | 'llms'
  | 'llms-full'
  | 'linkset'
  | 'api-catalog'
  | 'agent-card'
  | 'security'
  | 'robots'
  | 'tdmrep'
  | 'sustainability';

export interface SiteFileSpec {
  readonly id: SiteFileId;
  readonly path: string;
  /** Media types accepted, lower case, without parameters. */
  readonly accept: readonly string[];
  readonly maxBytes: number;
  /** A JSON file is dropped whole when it is cut: half a JSON text means nothing. */
  readonly json: boolean;
}

const KIB = 1024;
const TEXT = ['text/plain', 'text/markdown'];
const JSON_TYPES = ['application/json'];
const LINKSET = ['application/linkset+json', 'application/json'];

/**
 * At most nine files: this list is the cap. The research note (rule F4) set eight; the ninth,
 * `sustainability`, was added by owner approval of 14 Nov 2026 (package P2) because the
 * well-known file of the sustainability draft is small (8 KiB), fixed in path and read as data
 * only. `api-catalog` and `agent-card` are kept. docs/THREAT-MODEL.md names the same cap.
 */
export const SITE_FILES: readonly SiteFileSpec[] = [
  {
    id: 'linkset',
    path: '/.well-known/knowledge-linkset',
    accept: LINKSET,
    maxBytes: 256 * KIB,
    json: true,
  },
  { id: 'llms', path: '/llms.txt', accept: TEXT, maxBytes: 64 * KIB, json: false },
  { id: 'robots', path: '/robots.txt', accept: ['text/plain'], maxBytes: 500 * KIB, json: false },
  {
    id: 'tdmrep',
    path: '/.well-known/tdmrep.json',
    accept: JSON_TYPES,
    maxBytes: 32 * KIB,
    json: true,
  },
  {
    id: 'security',
    path: '/.well-known/security.txt',
    accept: ['text/plain'],
    maxBytes: 32 * KIB,
    json: false,
  },
  {
    id: 'api-catalog',
    path: '/.well-known/api-catalog',
    accept: LINKSET,
    maxBytes: 256 * KIB,
    json: true,
  },
  {
    id: 'agent-card',
    path: '/.well-known/agent-card.json',
    accept: JSON_TYPES,
    maxBytes: 128 * KIB,
    json: true,
  },
  { id: 'llms-full', path: '/llms-full.txt', accept: TEXT, maxBytes: 256 * KIB, json: false },
  {
    id: 'sustainability',
    path: '/.well-known/sustainability-data',
    accept: ['application/sustainability-data+json', 'application/json'],
    maxBytes: 8 * KIB,
    json: true,
  },
];

export const LIMITS = {
  /** One file ends after this long. */
  fileMs: 5000,
  /** All files of one page load end after this long. */
  totalMs: 10_000,
  maxFiles: 9,
  parallel: 2,
} as const;

export const specOf = (id: SiteFileId): SiteFileSpec => {
  const spec = SITE_FILES.find((item) => item.id === id);
  if (!spec) throw new Error(`unknown site file ${id}`);
  return spec;
};

/** What the page script saw: the answer to one request, text already cut at the cap. */
export interface SiteFileReply {
  readonly status: number;
  readonly contentType: string;
  /** The `Link` response header, cut; a linkset may name its profile there. */
  readonly link: string;
  readonly text: string;
  readonly cut: boolean;
  /** Base64 SHA-256 of the whole body, when the page script could compute it (not for a cut body). */
  readonly sha256?: string;
  /** Set when no answer came: the request failed or ran out of time. */
  readonly failed?: 'timeout' | 'network';
}

export type Trouble = 'timeout' | 'network' | 'server' | 'denied' | 'type' | 'size' | 'parse';

/** The four states of the card for a file that is not there (research note, F10). */
export type FileOutcome =
  | {
      readonly state: 'found';
      readonly text: string;
      readonly cut: boolean;
      readonly link: string;
      readonly contentType: string;
      /** Base64 SHA-256 of the raw bytes; compared in site-digest.ts. */
      readonly sha256?: string;
    }
  | { readonly state: 'not-published' }
  | { readonly state: 'unavailable'; readonly why: Trouble }
  | { readonly state: 'not-usable'; readonly why: Trouble };

/** "application/linkset+json; profile=..." -> "application/linkset+json" */
export function mediaType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

function missing(reply: SiteFileReply): FileOutcome | undefined {
  if (reply.failed) return { state: 'unavailable', why: reply.failed };
  if (reply.status === 404 || reply.status === 410) return { state: 'not-published' };
  if (reply.status === 401 || reply.status === 403) return { state: 'unavailable', why: 'denied' };
  if (reply.status >= 500) return { state: 'unavailable', why: 'server' };
  if (reply.status !== 200) return { state: 'unavailable', why: 'network' };
  return undefined;
}

/**
 * Judges one reply: status 200 only, a media type from the file's list (an HTML page is never
 * a data file, so a site that answers 200 with a page for every path is not believed), and a
 * JSON file that was cut is dropped. A text file that was cut keeps its first part.
 */
export function checkReply(
  spec: Pick<SiteFileSpec, 'accept' | 'json' | 'maxBytes'>,
  reply: SiteFileReply,
): FileOutcome {
  const problem = missing(reply);
  if (problem) return problem;
  if (!spec.accept.includes(mediaType(reply.contentType)))
    return { state: 'not-usable', why: 'type' };
  if (reply.cut && spec.json) return { state: 'not-usable', why: 'size' };
  const { text, cut, link, contentType, sha256 } = reply;
  const digest = sha256 === undefined || cut ? {} : { sha256 };
  return { state: 'found', text: text.slice(0, spec.maxBytes), cut, link, contentType, ...digest };
}
