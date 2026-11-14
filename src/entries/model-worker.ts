// SPDX-License-Identifier: Apache-2.0
// The dedicated Worker the offscreen document starts for the model (shared/webllm-factory.ts).
// It first answers the document's WebGPU probe (src/adapters/worker-gpu-probe.ts); every other
// message goes to WebLLM's handler, which runs the engine here when the probe found an adapter.
// When it found none, the engine runs on the document's main thread and this Worker stays open
// until the model unloads (the document is still opened for WORKERS, and that stays true).
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
import { limitAfterReload } from '../adapters/prefill-chunk';
import { isProbe, probeReply } from '../adapters/worker-gpu-probe';

const handler = new WebWorkerMLCEngineHandler();
// Short prefill chunks, so a slow GPU's watchdog never loses the device (prefill-chunk.ts).
limitAfterReload(handler.engine);
self.onmessage = (event: MessageEvent) => {
  if (!isProbe(event.data)) return handler.onmessage(event);
  void probeReply(navigator.gpu).then((reply) => self.postMessage(reply));
};
