// SPDX-License-Identifier: Apache-2.0
// What the query worker does, apart from the worker itself (so a test runs it over the Node build of
// the same engine): load the bytes of a node's graph.nq into a store, refuse one that is too big,
// and answer one query at a time with the engine's own read-only rules (third_party/agsc-query,
// engine.js `queryAnswer`: update and SERVICE refused before the engine sees them). Nothing here
// touches the network or the page: bytes come in, answers go out.
import { queryAnswer } from '../../third_party/agsc-query/engine.js';
import { QUERY_LIMITS, type LoadFormat, type QueryReply } from './protocol';

/** The part of the engine module (oxigraph) that is used. */
export interface Engine {
  readonly Store: new () => EngineStore;
}
export interface EngineStore {
  readonly size: number;
  load(data: Uint8Array, options: { format: string }): void;
}

export type LoadResult =
  { readonly ok: true; readonly size: number } | { readonly ok: false; readonly message: string };

interface JsonResult {
  head?: unknown;
  results?: { bindings: unknown[] };
  boolean?: boolean;
}

/** The result cut to `max` rows, and how many rows there were. ASK results pass unchanged. */
export function cutRows(json: string, max: number): { json: string; total: number } {
  const result = JSON.parse(json) as JsonResult;
  if (!result.results) return { json, total: 0 };
  const total = result.results.bindings.length;
  if (total <= max) return { json, total };
  const cut = { ...result, results: { bindings: result.results.bindings.slice(0, max) } };
  return { json: JSON.stringify(cut), total };
}

export interface QueryHandler {
  load(bytes: Uint8Array, format?: LoadFormat): LoadResult;
  run(id: number, text: string, maxRows: number): QueryReply;
}

const TOO_LONG = `The query is longer than ${QUERY_LIMITS.queryChars} characters, so it was not run.`;
const NO_GRAPH = 'No graph is loaded, so there is nothing to ask.';

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loadStore(
  engine: Engine,
  bytes: Uint8Array,
  format: LoadFormat,
): LoadResult & {
  store?: EngineStore;
} {
  try {
    const loaded = new engine.Store();
    loaded.load(bytes, { format });
    if (loaded.size > QUERY_LIMITS.quads) {
      const message = `The graph holds ${loaded.size} statements; WebAIAssist loads at most ${QUERY_LIMITS.quads}.`;
      return { ok: false, message };
    }
    return { ok: true, size: loaded.size, store: loaded };
  } catch (error) {
    return { ok: false, message: `The graph could not be read: ${describe(error)}`.slice(0, 300) };
  }
}

interface Ask {
  readonly id: number;
  readonly text: string;
  readonly max: number;
}

const failed = (id: number, error: string): QueryReply => ({
  type: 'answer',
  id,
  form: null,
  error,
});

function answerOf(engine: Engine, store: EngineStore, ask: Ask) {
  const { id, text, max } = ask;
  const answer = queryAnswer(engine, store, text);
  if (answer.error !== undefined || answer.json === undefined) {
    return { ...failed(id, answer.error ?? 'The engine gave no result.'), form: answer.form };
  }
  try {
    const cut = cutRows(answer.json, max);
    return { type: 'answer' as const, id, form: answer.form, json: cut.json, total: cut.total };
  } catch (error) {
    return failed(id, `The result could not be read: ${describe(error)}`.slice(0, 300));
  }
}

export function createQueryHandler(engine: Engine): QueryHandler {
  let store: EngineStore | undefined;
  return {
    load(bytes, format = 'application/n-quads') {
      const result = loadStore(engine, bytes, format);
      store = result.ok ? result.store : undefined;
      return result.ok ? { ok: true, size: result.size } : result;
    },
    run(id, text, maxRows) {
      if (store === undefined) return failed(id, NO_GRAPH);
      if (text.length > QUERY_LIMITS.queryChars) return failed(id, TOO_LONG);
      return answerOf(engine, store, { id, text, max: maxRows });
    },
  };
}
