// SPDX-License-Identifier: Apache-2.0
// Port: the read-only questions the assistant may ask of the open node's published knowledge graph.
// The adapter (src/adapters/graph-query.ts) reads the node's graph.nq through the tab and answers
// with a query engine inside the extension; nothing is sent anywhere. Texts are already formatted
// for the model, and are node-author text: the caller fences them as untrusted.
import type { CancelSignal } from '../types';

/** The tab and the site the question is about. */
export interface GraphScope {
  readonly tabId: number;
  readonly origin: string;
}

export interface QueryOutcome {
  readonly ok: boolean;
  readonly text: string;
}

export interface GraphQuery {
  /** True when this site is a node whose graph the extension may read for the model. */
  available(scope: GraphScope): Promise<boolean>;
  /** The classes and properties of the graph, as a short text. */
  summary(scope: GraphScope, signal?: CancelSignal): Promise<QueryOutcome>;
  /** One read-only SPARQL query (SELECT or ASK) and its rows, as a short text. */
  run(scope: GraphScope, sparql: string, signal?: CancelSignal): Promise<QueryOutcome>;
}
