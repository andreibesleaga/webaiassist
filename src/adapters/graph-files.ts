// SPDX-License-Identifier: Apache-2.0
// Reads one file of a node's graph (src/core/graph-files.ts) through the open tab, the same way
// src/adapters/site-files.ts reads a site file: a script in the tab's isolated world makes one
// same-origin request for the tab's origin plus the fixed path, and the answer is checked against
// the `site/graph-file` schema before any of it is used. Never throws.
import { checkReply, LIMITS, type FileOutcome } from '../core/site-files';
import type { GraphFileSpec } from '../core/graph-files';
import type { SiteGraphFileMessage } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';
import type { SiteReadDeps, SiteTarget } from './site-files';
import { fetchSiteFile, type PageFileRequest } from './site-page-scripts';

/** The page script has its own time limit; this one only catches a script that never answers. */
const MARGIN_MS = 1000;
const LOST: FileOutcome = { state: 'unavailable', why: 'timeout' };

function request(spec: GraphFileSpec, origin: string): PageFileRequest {
  return {
    id: spec.id,
    path: spec.path,
    origin,
    accept: spec.accept.join(', '),
    maxBytes: spec.maxBytes,
    timeoutMs: LIMITS.fileMs,
    type: 'site/graph-file',
  };
}

async function run(deps: SiteReadDeps, target: SiteTarget, spec: GraphFileSpec): Promise<unknown> {
  const results = await deps.scripting.executeScript({
    target: { tabId: target.tabId },
    world: 'ISOLATED',
    func: fetchSiteFile,
    args: [request(spec, target.origin)],
  });
  return results[0]?.result;
}

function reply(
  raw: unknown,
  spec: GraphFileSpec,
  origin: string,
): SiteGraphFileMessage | undefined {
  const parsed = parseMessage(raw, 'site');
  if (!parsed.ok || parsed.value.type !== 'site/graph-file') return undefined;
  const message = parsed.value;
  return message.id === spec.id && message.origin === origin ? message : undefined;
}

/** One graph file: its outcome, whatever goes wrong. */
export async function readGraphFile(
  deps: SiteReadDeps,
  target: SiteTarget,
  spec: GraphFileSpec,
): Promise<FileOutcome> {
  const timer = deps.timer(LIMITS.fileMs + MARGIN_MS);
  try {
    const raw = await Promise.race([run(deps, target, spec), timer.done.then(() => undefined)]);
    if (raw === undefined) return LOST;
    const message = reply(raw, spec, target.origin);
    return message ? checkReply(spec, message) : { state: 'not-usable', why: 'parse' };
  } catch {
    return { state: 'unavailable', why: 'network' };
  } finally {
    timer.cancel();
  }
}
