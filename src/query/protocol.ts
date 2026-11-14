// SPDX-License-Identifier: Apache-2.0
// The messages between a page that asks questions of a node's graph and the query worker. Bytes of
// the graph go in; answers come out; the worker never reads anything itself (no fetch, no tab).

export type LoadFormat = 'application/n-quads' | 'text/turtle';

/** What a page sends to the worker. */
export type ToWorker =
  | {
      readonly type: 'load';
      readonly bytes: Uint8Array;
      /** N-Quads (the node's graph, the default) or Turtle (the vocabulary store of its own). */
      readonly format?: LoadFormat;
    }
  | {
      readonly type: 'run';
      readonly id: number;
      readonly text: string;
      /** The most rows kept in the answer; more are counted and dropped inside the worker. */
      readonly maxRows: number;
    };

/** One answer: the result in the W3C JSON results format (cut to `maxRows`) or a sentence. */
export interface QueryReply {
  readonly type: 'answer';
  readonly id: number;
  readonly form: string | null;
  readonly json?: string;
  /** How many rows the engine returned before the cut. */
  readonly total?: number;
  readonly error?: string;
}

/** What the worker sends back. */
export type FromWorker =
  | { readonly type: 'ready'; readonly size: number }
  | { readonly type: 'error'; readonly message: string }
  | QueryReply;

/** The limits of the engine side, in one place. */
export const QUERY_LIMITS = {
  /** Characters of one query. */
  queryChars: 4000,
  /** Quads one store may hold; a larger graph is refused whole. */
  quads: 200_000,
  /** Rows the Query tab shows. */
  tabRows: 200,
  /** Run time in the Query tab, then the worker is ended. */
  tabMs: 10_000,
  /** Run time of the model's call, then the worker is ended. */
  modelMs: 8000,
  /** Characters of the model's own query (the tool's schema says the same). */
  modelQueryChars: 1500,
  /** Rows and characters one result gives the model. */
  modelRows: 25,
  modelChars: 3000,
  /** Characters of the summary the model gets when it calls the tool without a query. */
  summaryChars: 1500,
} as const;
