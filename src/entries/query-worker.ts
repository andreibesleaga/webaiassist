// SPDX-License-Identifier: Apache-2.0
// The query worker (a module Worker of an extension page). It holds the engine (oxigraph, WebAssembly,
// from model-libs/oxigraph.wasm inside the package) and one store, loaded from bytes the page posts.
// It makes no request of its own: it has no fetch call and is given no address. A page ends it to
// stop a query (the engine is synchronous). See src/query/worker-core.ts for the read-only rules.
import init, * as engine from 'oxigraph/web.js';
import { createQueryHandler } from '../query/worker-core';
import type { FromWorker, ToWorker } from '../query/protocol';

const handler = createQueryHandler(engine);
const send = (message: FromWorker): void => self.postMessage(message);

const ready = init({
  module_or_path: new URL('model-libs/oxigraph.wasm', self.location.href).href,
}).then(
  () => true,
  (error: unknown) => {
    send({ type: 'error', message: `The query engine did not start: ${String(error)}` });
    return false;
  },
);

self.onmessage = (event: MessageEvent<ToWorker>): void => {
  const message = event.data;
  void ready.then((ok) => {
    if (!ok) return;
    if (message.type === 'load') {
      const loaded = handler.load(message.bytes, message.format);
      send(
        loaded.ok
          ? { type: 'ready', size: loaded.size }
          : { type: 'error', message: loaded.message },
      );
    } else if (message.type === 'run') {
      send(handler.run(message.id, message.text, message.maxRows));
    }
  });
};
