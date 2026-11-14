// SPDX-License-Identifier: Apache-2.0
// The real WebLLM engine, created inside the model host. WebLLM gets only the four shipped
// models (src/adapters/webllm-app-config.ts): the model library is read from inside the
// package and hash-checked, and so are the model's config and tokenizer; the weights
// download once from Hugging Face and stay in WebLLM's cache.
// In the offscreen document the engine runs in a dedicated Worker (model-worker.js, through
// WebLLM's WebWorkerMLCEngine) when that Worker has a WebGPU adapter; otherwise it runs on the
// document's main thread, the place the owner's measured run found WebGPU
// (src/adapters/worker-gpu-probe.ts). The Worker stays open either way, so the reason the
// document is opened for (WORKERS) stays true. The service worker, the fallback host, cannot
// start a Worker, so there the engine runs in place.
import {
  MLCEngine,
  WebWorkerMLCEngine,
  type AppConfig,
  type InitProgressReport,
  type MLCEngineConfig,
} from '@mlc-ai/web-llm';
import { limitAfterReload } from '../../adapters/prefill-chunk';
import { bundledAppConfig } from '../../adapters/webllm-app-config';
import { askWorker, placeEngine } from '../../adapters/worker-gpu-probe';
import type { WebLlmEngineLike, WebLlmFactory } from '../../adapters/webllm-runtime';

export const MODEL_WORKER_FILE = 'model-worker.js';

const appConfig = bundledAppConfig((path) => chrome.runtime.getURL(path)) as unknown as AppConfig;

interface Loadable extends WebLlmEngineLike {
  reload(modelId: string): Promise<void>;
}

function engineConfig(onProgress: Parameters<WebLlmFactory>[1]): MLCEngineConfig {
  return {
    appConfig,
    initProgressCallback: (report: InitProgressReport) =>
      onProgress({ progress: report.progress, text: report.text }),
  };
}

const CANCELLED = 'The download was cancelled.';

/** Loads the model. Cancel (the signal) ends the load at once: WebLLM's reload cannot be
 *  interrupted, so in a Worker `kill` (terminate) stops the download and the GPU work, and on
 *  the main thread the engine is unloaded the moment the reload returns (the download runs on,
 *  nothing can stop it there). The measured run of 13 Nov 2026 showed why: a cancelled load that
 *  ran on put a second model on the GPU and lost the device (DXGI_ERROR_DEVICE_REMOVED). */
async function loadInto<T extends Loadable>(
  engine: T,
  modelId: string,
  signal?: AbortSignal,
  kill?: () => void,
) {
  const reload = engine.reload(modelId);
  const cancelled = new Promise<never>((_, reject) => {
    const cancel = (): void => {
      kill?.();
      void reload.then(() => engine.unload()).catch(() => undefined);
      reject(new Error(CANCELLED));
    };
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    void reload.finally(() => signal?.removeEventListener('abort', cancel)).catch(() => undefined);
  });
  await Promise.race([reload, cancelled]);
  return engine;
}

const PROBE_TIMEOUT_MS = 10_000;

/** The engine in the module Worker; unloading it also ends the Worker. */
async function inWorker(
  worker: Worker,
  modelId: string,
  config: MLCEngineConfig,
  signal?: AbortSignal,
) {
  const engine = new WebWorkerMLCEngine(worker, config);
  await loadInto(engine as unknown as Loadable, modelId, signal, () => worker.terminate());
  const unload = async (): Promise<void> => {
    await engine.unload().catch(() => undefined);
    worker.terminate();
  };
  const like = engine as unknown as WebLlmEngineLike;
  return { chat: like.chat, interruptGenerate: () => like.interruptGenerate(), unload };
}

/** The engine on the document's main thread; the Worker that answered the probe ends with it. */
async function onMain(
  worker: Worker,
  modelId: string,
  config: MLCEngineConfig,
  signal?: AbortSignal,
) {
  const engine = await loadInto(
    limitAfterReload(new MLCEngine(config)) as unknown as Loadable,
    modelId,
    signal,
  );
  const unload = async (): Promise<void> => {
    await engine.unload().catch(() => undefined);
    worker.terminate();
  };
  return { chat: engine.chat, interruptGenerate: () => engine.interruptGenerate(), unload };
}

async function inOffscreen(modelId: string, config: MLCEngineConfig, signal?: AbortSignal) {
  const worker = new Worker(chrome.runtime.getURL(MODEL_WORKER_FILE), { type: 'module' });
  try {
    const { engine, where } = await placeEngine({
      probe: () => askWorker(worker, PROBE_TIMEOUT_MS),
      inWorker: () => inWorker(worker, modelId, config, signal),
      onMain: () => onMain(worker, modelId, config, signal),
    });
    return { ...engine, where };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

export const createWebLlmEngine: WebLlmFactory = async (modelId, onProgress, signal) => {
  const config = engineConfig(onProgress);
  if (typeof Worker === 'function') return inOffscreen(modelId, config, signal);
  const engine = await loadInto(
    limitAfterReload(new MLCEngine(config)) as unknown as Loadable,
    modelId,
    signal,
  );
  return {
    chat: engine.chat,
    interruptGenerate: () => engine.interruptGenerate(),
    unload: () => engine.unload(),
    where: 'service-worker',
  };
};
