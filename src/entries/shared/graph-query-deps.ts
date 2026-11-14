// SPDX-License-Identifier: Apache-2.0
// The model's read-only graph tool for the side panel: the node's graph.nq is read through the tab (the same
// isolated-world read as the site files), and answered by the query worker of this extension.
import { createTabReader } from '../../adapters/explorer-tab-reader';
import { createGraphQuery } from '../../adapters/graph-query';
import { sha256Base64 } from '../../adapters/sha256';
import { explorerDeps } from './explorer-deps';
import { makeQueryWorker } from './query-worker-factory';

export const panelGraphQuery = createGraphQuery({
  readerFor: (scope) => createTabReader(explorerDeps, scope),
  sha256: sha256Base64,
  makeWorker: makeQueryWorker,
});
