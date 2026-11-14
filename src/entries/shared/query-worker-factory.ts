// SPDX-License-Identifier: Apache-2.0
// Starts the query worker (query-worker.js, a module Worker of this extension) for the explorer page and for
// the side panel. The worker is given bytes and queries by message and has no address of its own.
import type { WorkerPort } from '../../adapters/query-session';

export function makeQueryWorker(): WorkerPort {
  const worker = new Worker(chrome.runtime.getURL('query-worker.js'), { type: 'module' });
  return worker as unknown as WorkerPort;
}
