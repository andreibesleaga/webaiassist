// SPDX-License-Identifier: Apache-2.0
// The `fetch` the explorer page gives to the site's own explorer code (third_party/agsc-explorer,
// which stays unchanged). Every address is judged by src/adapters/graph-fetch-guard.ts first:
// - the node's own files come through the open tab (a same-origin read in the tab's isolated
//   world, with the fixed list and caps), and are made into a Response here;
// - a peer the user ticked is read with one plain request: GET, no cookies, no referrer, no cache,
//   no redirect, 5 seconds, 2 MiB;
// - anything else is refused with a plain sentence the explorer shows as its status.
// A graph or chunk file must match the SHA-256 digest the node's linkset declared for it: a
// mismatch is refused, shown, and the graph is not drawn.
import { declaredDigests } from './linkset-digests';
import {
  decide,
  digestMismatchText,
  refusalText,
  troubleText,
  type GuardedFile,
  type GuardState,
} from './graph-fetch-guard';
import type { FileOutcome } from '../core/site-files';

export interface ShimDeps {
  readonly state: GuardState;
  /** One fixed file of the open node, read through the tab. */
  readTab(spec: GuardedFile): Promise<FileOutcome>;
  readonly realFetch: typeof fetch;
  /** The base64 SHA-256 of the bytes. */
  sha256(bytes: Uint8Array): Promise<string>;
  /** Called with a plain sentence when a file is refused for its digest. */
  onProblem(text: string): void;
}

const PEER_MS = 5000;
const PEER_MAX_BYTES = 2 * 1024 * 1024;
const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

function tooBig(): Error {
  return new Error('is larger than WebAIAssist reads from a peer (2 MB), so it was not read');
}

/** The body of a peer's answer, at most 2 MiB: refused by its declared length, else while it streams. */
async function readCapped(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > PEER_MAX_BYTES) throw tooBig();
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > PEER_MAX_BYTES) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(value);
  }
  return new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer());
}

async function readPeer(
  deps: ShimDeps,
  url: string,
): Promise<{ response: Response; bytes: Uint8Array }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PEER_MS);
  try {
    const response = await deps.realFetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      signal: controller.signal,
    });
    return { response, bytes: await readCapped(response) };
  } finally {
    clearTimeout(timer);
  }
}

function fromOutcome(
  outcome: FileOutcome,
  path: string,
): { status: number; type: string; bytes: Uint8Array } {
  if (outcome.state === 'found') {
    return { status: 200, type: outcome.contentType, bytes: encode(outcome.text) };
  }
  if (outcome.state === 'not-published')
    return { status: 404, type: 'text/plain', bytes: new Uint8Array() };
  throw new Error(`${path}: ${troubleText(outcome.why)}`);
}

export function createGuardedFetch(deps: ShimDeps): typeof fetch {
  const declared = new Map<string, string>();

  async function check(url: string, spec: GuardedFile, bytes: Uint8Array): Promise<void> {
    const parsed = new URL(url);
    if (spec === 'linkset') {
      const text = new TextDecoder().decode(bytes);
      for (const [key, value] of declaredDigests(text, parsed.origin)) declared.set(key, value);
      return;
    }
    const expected = declared.get(`${parsed.origin}${parsed.pathname}`);
    if (expected === undefined || expected === (await deps.sha256(bytes))) return;
    const problem = digestMismatchText(parsed.pathname, parsed.host);
    deps.onProblem(problem);
    throw new Error(problem);
  }

  async function serve(url: string): Promise<Response> {
    const decision = decide(url, deps.state);
    if (decision.kind === 'refuse') throw new Error(refusalText(decision.why));
    if (decision.kind === 'tab') {
      const read = fromOutcome(await deps.readTab(decision.spec), decision.path);
      if (read.status === 200) await check(url, decision.spec, read.bytes);
      return new Response(read.bytes as BlobPart, {
        status: read.status,
        headers: { 'content-type': read.type },
      });
    }
    const { response, bytes } = await readPeer(deps, decision.url);
    if (response.ok) await check(url, decision.spec, bytes);
    return new Response(bytes as BlobPart, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? '' },
    });
  }

  return (input) =>
    serve(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
}
