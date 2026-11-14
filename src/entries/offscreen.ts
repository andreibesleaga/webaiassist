// SPDX-License-Identifier: Apache-2.0
// Offscreen document: the model host (chosen from the maintainer's measured run of 12 Nov 2026,
// docs/SPIKE.md). It has only the `runtime` extension API. It answers the WebGPU probe sent
// by the service worker and serves the side panel's model port; the model itself runs in a
// Worker the document starts (shared/webllm-factory.ts), the reason it is opened for.
import { probeWebGpu } from '../adapters/webgpu-probe';
import { parseMessage } from '../protocol/validate';
import { hostModels } from './shared/model-hosting';

/** Only the extension's own service worker sends the probe: its exact URL, not a suffix. */
const fromServiceWorker = (sender: chrome.runtime.MessageSender): boolean =>
  sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('service-worker.js');

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (!fromServiceWorker(sender)) return false;
  const parsed = parseMessage(raw, 'offscreen');
  if (!parsed.ok || parsed.value.type !== 'probe/gpu' || parsed.value.target !== 'offscreen') {
    return false;
  }
  const id = parsed.value.id;
  void probeWebGpu(navigator.gpu).then((report) =>
    sendResponse({ type: 'probe/gpu-result', id, target: 'offscreen', report }),
  );
  return true;
});

hostModels('offscreen');
