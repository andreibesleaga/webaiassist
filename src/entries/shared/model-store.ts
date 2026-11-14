// SPDX-License-Identifier: Apache-2.0
// The real model store of the side panel and the Options page: the processor models in the
// extension's file storage and the graphics-card models in WebLLM's cache. Both pages are on the
// extension's own origin, so they see the same storage the offscreen document writes.
import type { AppConfig } from '@mlc-ai/web-llm';
import { CPU_MODELS } from '../../adapters/cpu-models';
import {
  bytesUnder,
  cpuBackend,
  ModelStore,
  webllmBackend,
  type CacheLike,
  type WebLlmFiles,
} from '../../adapters/model-store';
import { bundledAppConfig } from '../../adapters/webllm-app-config';
import { cpuStorage, cpuTestModels } from './cpu-engine';

/** The scope WebLLM keeps the weights in (its cacheBackend is the Cache API). */
const WEBLLM_MODEL_SCOPE = 'webllm/model';

const appConfig = (): AppConfig =>
  bundledAppConfig((path) => chrome.runtime.getURL(path)) as unknown as AppConfig;

/** WebLLM is loaded on first use: the page that only lists models does not carry it at start. */
const webllm = (): Promise<typeof import('@mlc-ai/web-llm')> => import('@mlc-ai/web-llm');

async function weightsBytes(id: string): Promise<number> {
  const record = appConfig().model_list.find((m) => m.model_id === id);
  if (!record) return 0;
  const cache = (await caches.open(WEBLLM_MODEL_SCOPE)) as unknown as CacheLike;
  return bytesUnder(cache, record.model);
}

/** WebLLM's delete removes the weight shards, the tokenizer, the library and the config, but
 *  leaves the small shard index (tensor-cache.json); it goes too, so nothing of the model stays. */
async function removeModel(id: string): Promise<void> {
  const config = appConfig();
  await (await webllm()).deleteModelAllInfoInCache(id, config);
  const record = config.model_list.find((m) => m.model_id === id);
  if (!record) return;
  const cache = await caches.open(WEBLLM_MODEL_SCOPE);
  await cache.delete(new URL('tensor-cache.json', record.model).href);
}

const webllmFiles: WebLlmFiles = {
  has: async (id) => (await webllm()).hasModelInCache(id, appConfig()),
  size: weightsBytes,
  remove: removeModel,
};

export function createModelStore(): ModelStore {
  return new ModelStore([
    webllmBackend(webllmFiles),
    cpuBackend(cpuStorage(), [...CPU_MODELS, ...cpuTestModels]),
  ]);
}
