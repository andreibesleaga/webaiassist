// SPDX-License-Identifier: Apache-2.0
// Hosts the model runtimes in this context and serves the side panel's model ports.
// The offscreen document is the host; the service worker is the fallback (host-choice.ts).
// Two ports: `model-host:<target>` for WebLLM on the graphics card, and, in the offscreen
// document only, `model-host:cpu` for llama.cpp on the processor (it needs a Worker, which the
// service worker cannot start). Loading one runtime lets the other go first.
import type { HostTarget } from '../../adapters/host-choice';
import { ExclusiveRuntime } from '../../adapters/exclusive-runtime';
import { MODEL_PORT_PREFIX, serveModelHost } from '../../adapters/model-host';
import { WebLlmRuntime } from '../../adapters/webllm-runtime';
import { WllamaRuntime } from '../../adapters/wllama-runtime';
import type { ModelRuntime } from '../../core/ports/model-runtime';
import { cpuEngine, cpuTestModels } from './cpu-engine';
import { fromExtensionPage } from './sender';
import { createWebLlmEngine } from './webllm-factory';

export const CPU_PORT_NAME = `${MODEL_PORT_PREFIX}cpu`;

interface Host {
  readonly runtime: ModelRuntime;
  readonly onDeviceLost?: () => void;
}

export function hostModels(target: HostTarget): void {
  const webllm = new WebLlmRuntime(createWebLlmEngine);
  // A lost GPU device stays lost in this document (measured 13 Nov 2026): the offscreen
  // document closes itself (window.close() is how an offscreen document ends, per the Chromium
  // extensions team) and the service worker opens a fresh one, with a fresh adapter, at the
  // panel's next Start (its probe calls ensureOffscreen). The service worker cannot restart.
  const restart =
    target === 'offscreen'
      ? (): void => {
          void webllm
            .unload()
            .catch(() => undefined)
            .finally(() => window.close());
        }
      : undefined;
  const hosts = new Map<string, Host>();
  if (target === 'offscreen') {
    const cpu = new WllamaRuntime(cpuEngine, cpuTestModels);
    hosts.set(CPU_PORT_NAME, { runtime: new ExclusiveRuntime(cpu, () => [webllm]) });
    hosts.set(`${MODEL_PORT_PREFIX}${target}`, {
      runtime: new ExclusiveRuntime(webllm, () => [cpu]),
      ...(restart ? { onDeviceLost: restart } : {}),
    });
  } else {
    hosts.set(`${MODEL_PORT_PREFIX}${target}`, { runtime: webllm });
  }
  chrome.runtime.onConnect.addListener((port) => {
    const host = hosts.get(port.name);
    if (!host || !fromExtensionPage(port.sender)) return;
    serveModelHost(port, host.runtime, host.onDeviceLost);
  });
}
