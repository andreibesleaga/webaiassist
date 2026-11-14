// SPDX-License-Identifier: Apache-2.0
// The model's read-only questions to a node's graph (port src/core/ports/graph-query.ts). It reads
// the node's graph.nq through the tab (graph-load.ts), asks the query worker (query-session.ts), and writes
// the answer as short text. The texts of failures are fixed sentences. Nothing is sent anywhere.
import type { GraphQuery, GraphScope, QueryOutcome } from '../core/ports/graph-query';
import type { CancelSignal } from '../core/types';
import { rowsText, SUMMARY_QUERIES, summaryText } from '../query/format';
import { QUERY_LIMITS, type QueryReply } from '../query/protocol';
import { declaredDigest, loadNodeFile } from './graph-load';
import type { TabFile } from './explorer-tab-reader';
import {
  createQuerySession,
  type QuerySession,
  type RunOutcome,
  type WorkerPort,
} from './query-session';
import type { FileOutcome } from '../core/site-files';

export interface GraphQueryDeps {
  /** A reader of the files of the tab and origin of the run (explorer-tab-reader.ts). */
  readonly readerFor: (scope: GraphScope) => (spec: TabFile) => Promise<FileOutcome>;
  readonly sha256: (bytes: Uint8Array) => Promise<string>;
  readonly makeWorker: () => WorkerPort;
}

const ENGINE_ERROR_CAP = 260;
export const TIMEOUT_TEXT = `The query took longer than ${QUERY_LIMITS.modelMs / 1000} seconds and was stopped. Add LIMIT or ask for less.`;
const STOPPED_TEXT = 'The query was stopped.';
const TOO_LONG_TEXT = `The query is longer than ${QUERY_LIMITS.modelQueryChars} characters, so it was not run.`;

const limits = { rows: QUERY_LIMITS.modelRows, chars: QUERY_LIMITS.modelChars };

function outcomeText(outcome: RunOutcome): QueryOutcome {
  if (outcome.kind === 'timeout') return { ok: false, text: TIMEOUT_TEXT };
  if (outcome.kind === 'stopped') return { ok: false, text: STOPPED_TEXT };
  if (outcome.kind === 'failed')
    return { ok: false, text: outcome.text.slice(0, ENGINE_ERROR_CAP) };
  const reply: QueryReply = outcome.reply;
  if (reply.error !== undefined || reply.json === undefined) {
    return {
      ok: false,
      text: (reply.error ?? 'The engine gave no result.').slice(0, ENGINE_ERROR_CAP),
    };
  }
  return { ok: true, text: rowsText(reply.json, reply.total ?? 0, limits) };
}

/** The summary of a graph: three fixed queries, written as one short text. */
async function summaryOf(ask: (text: string) => Promise<RunOutcome>): Promise<QueryOutcome> {
  const parts = { classes: '', properties: '', sample: '' };
  for (const key of ['classes', 'properties', 'sample'] as const) {
    const outcome = outcomeText(await ask(SUMMARY_QUERIES[key]));
    if (!outcome.ok) return outcome;
    parts[key] = outcome.text;
  }
  return { ok: true, text: summaryText(parts) };
}

export function createGraphQuery(deps: GraphQueryDeps): GraphQuery {
  let current: { key: string; session: QuerySession } | undefined;

  /** One session at a time: a question about another tab or site ends the earlier worker. */
  function sessionFor(scope: GraphScope): QuerySession {
    const key = `${scope.tabId} ${scope.origin}`;
    if (current?.key === key) return current.session;
    current?.session.close();
    const load = { readTab: deps.readerFor(scope), sha256: deps.sha256 };
    const session = createQuerySession({
      loadBytes: () => loadNodeFile(load, scope.origin),
      makeWorker: deps.makeWorker,
    });
    current = { key, session };
    return session;
  }

  const ask = (scope: GraphScope, text: string, signal?: CancelSignal): Promise<RunOutcome> =>
    sessionFor(scope).run(text, {
      maxRows: QUERY_LIMITS.modelRows,
      ms: QUERY_LIMITS.modelMs,
      ...(signal ? { signal } : {}),
    });

  return {
    available: async (scope) =>
      (await declaredDigest({ readTab: deps.readerFor(scope) }, scope.origin, 'graph-nq')) !==
      undefined,
    run: async (scope, sparql, signal) =>
      sparql.length > QUERY_LIMITS.modelQueryChars
        ? { ok: false, text: TOO_LONG_TEXT }
        : outcomeText(await ask(scope, sparql, signal)),
    summary: (scope, signal) => summaryOf((text) => ask(scope, text, signal)),
  };
}
