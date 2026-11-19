// SPDX-License-Identifier: Apache-2.0
// Hosts the model runtimes in the offscreen document and serves the side panel's model ports.
// Two ports, both llama.cpp: `model-host:offscreen` for the models on the graphics card and
// `model-host:cpu` for the models on the processor. The engine needs a Worker, which the service
// worker cannot start, so the service worker hosts no model. Loading one runtime lets the other
// go first.
import type { HostTarget } from '../../adapters/host-choice';
import { ExclusiveRuntime } from '../../adapters/exclusive-runtime';
import { MODEL_PORT_PREFIX, serveModelHost } from '../../adapters/model-host';
import { WllamaRuntime } from '../../adapters/wllama-runtime';
import type { ModelRuntime } from '../../core/ports/model-runtime';
import { cpuEngine, cpuTestModels } from './cpu-engine';
import { fromExtensionPage } from './sender';

export const CPU_PORT_NAME = `${MODEL_PORT_PREFIX}cpu`;

interface Host {
  readonly runtime: ModelRuntime;
  readonly onDeviceLost?: () => void;
}

export function hostModels(target: HostTarget): void {
  const hosts = new Map<string, Host>();
  if (target === 'offscreen') {
    const gpu = new WllamaRuntime(cpuEngine, cpuTestModels, 'gpu');
    const cpu = new WllamaRuntime(cpuEngine, cpuTestModels);
    // A lost GPU device stays lost in this document (measured 13 Nov 2026): the offscreen
    // document closes itself (window.close() is how an offscreen document ends, per the Chromium
    // extensions team) and the service worker opens a fresh one, with a fresh adapter, at the
    // panel's next Start (its probe calls ensureOffscreen).
    const restart = (): void => {
      void gpu
        .unload()
        .catch(() => undefined)
        .finally(() => window.close());
    };
    hosts.set(CPU_PORT_NAME, { runtime: new ExclusiveRuntime(cpu, () => [gpu]) });
    hosts.set(`${MODEL_PORT_PREFIX}${target}`, {
      runtime: new ExclusiveRuntime(gpu, () => [cpu]),
      onDeviceLost: restart,
    });
  }
  chrome.runtime.onConnect.addListener((port) => {
    const host = hosts.get(port.name);
    if (!host || !fromExtensionPage(port.sender)) return;
    serveModelHost(port, host.runtime, host.onDeviceLost);
  });
}
