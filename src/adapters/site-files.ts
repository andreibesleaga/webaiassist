// SPDX-License-Identifier: Apache-2.0
// Reads what an allowed site publishes: the fixed list of files (src/core/site-files.ts) and
// the open page's own data. Each read runs in the tab's isolated world, so the request is a
// same-origin request that carries no extension origin (site-page-scripts.ts). Rules, from the
// research note: nothing before the site is allowed (the caller starts this only after the
// page's tools could be listed), at most eight files, two at a time, 5 seconds each and
// 10 seconds in all, and every answer is checked against its schema before it is used.
import {
  checkReply,
  LIMITS,
  SITE_FILES,
  type FileOutcome,
  type SiteFileSpec,
} from '../core/site-files';
import type { Outcomes } from '../core/site-facts';
import type { PageMeta } from '../core/site-page';
import type { SiteFileMessage, SitePageMessage } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';
import { fetchSiteFile, readPageMeta, type PageFileRequest } from './site-page-scripts';

export interface SiteScripting {
  executeScript(injection: {
    target: { tabId: number };
    world: 'ISOLATED';
    func: (...args: never[]) => unknown;
    args?: unknown[];
  }): Promise<{ result?: unknown }[]>;
}

/** A timer the caller can stop: `done` resolves after `ms` unless `cancel` was called. */
export interface Timer {
  readonly done: Promise<void>;
  cancel(): void;
}

export interface SiteReadDeps {
  readonly scripting: SiteScripting;
  readonly timer: (ms: number) => Timer;
}

export interface SiteTarget {
  readonly tabId: number;
  readonly origin: string;
}

/** The page script has its own time limit; this one only catches a script that never answers. */
const MARGIN_MS = 1000;
const LOST: FileOutcome = { state: 'unavailable', why: 'timeout' };

function request(spec: SiteFileSpec, origin: string): PageFileRequest {
  return {
    id: spec.id,
    path: spec.path,
    origin,
    accept: spec.accept.join(', '),
    maxBytes: spec.maxBytes,
    timeoutMs: LIMITS.fileMs,
  };
}

async function run(deps: SiteReadDeps, target: SiteTarget, spec: SiteFileSpec): Promise<unknown> {
  const injection = {
    target: { tabId: target.tabId },
    world: 'ISOLATED' as const,
    func: fetchSiteFile,
    args: [request(spec, target.origin)],
  };
  const results = await deps.scripting.executeScript(injection);
  return results[0]?.result;
}

function reply(raw: unknown, spec: SiteFileSpec, origin: string): SiteFileMessage | undefined {
  const parsed = parseMessage(raw, 'site');
  if (!parsed.ok || parsed.value.type !== 'site/file') return undefined;
  const message = parsed.value;
  return message.id === spec.id && message.origin === origin ? message : undefined;
}

/** One file: its outcome, whatever goes wrong. Never throws. */
export async function readSiteFile(
  deps: SiteReadDeps,
  target: SiteTarget,
  spec: SiteFileSpec,
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

/**
 * All files of the list, two at a time, in 10 seconds at most; a file that did not finish is
 * "unavailable". Files already read in this page load are not read again (the caller keeps
 * the result per tab and origin).
 */
export async function readSiteFiles(deps: SiteReadDeps, target: SiteTarget): Promise<Outcomes> {
  const outcomes: Outcomes = {};
  const queue = SITE_FILES.slice(0, LIMITS.maxFiles);
  const total = deps.timer(LIMITS.totalMs);
  let expired = false;
  void total.done.then(() => {
    expired = true;
  });
  const worker = async (): Promise<void> => {
    for (let spec = queue.shift(); spec && !expired; spec = queue.shift()) {
      outcomes[spec.id] = await readSiteFile(deps, target, spec);
    }
  };
  await Promise.race([Promise.all(Array.from({ length: LIMITS.parallel }, worker)), total.done]);
  total.cancel();
  const result: Outcomes = {};
  for (const spec of SITE_FILES) result[spec.id] = outcomes[spec.id] ?? LOST;
  return result;
}

function toMeta(message: SitePageMessage): PageMeta {
  const { title, language, description, og, jsonLd, links, tdm } = message;
  return {
    title,
    og,
    jsonLd,
    links,
    ...(language === undefined ? {} : { language }),
    ...(description === undefined ? {} : { description }),
    ...(tdm === undefined ? {} : { tdm }),
  };
}

/** What the open page says about itself (JSON-LD, Open Graph, meta); undefined when it cannot be read. */
export async function readPageData(
  deps: Pick<SiteReadDeps, 'scripting'>,
  target: SiteTarget,
): Promise<PageMeta | undefined> {
  try {
    const results = await deps.scripting.executeScript({
      target: { tabId: target.tabId },
      world: 'ISOLATED',
      func: readPageMeta,
    });
    const parsed = parseMessage(results[0]?.result, 'site');
    if (!parsed.ok || parsed.value.type !== 'site/page') return undefined;
    return parsed.value.origin === target.origin ? toMeta(parsed.value) : undefined;
  } catch {
    return undefined;
  }
}
