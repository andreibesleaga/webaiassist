// SPDX-License-Identifier: Apache-2.0
// WebLLM prefills a prompt in chunks whose size comes from the model library's metadata
// (1024 tokens for Qwen3, Llama 3.2 and Qwen3.5, 512 for Gemma 4 E2B). One chunk is one run of GPU
// work; on a slow GPU a chunk runs longer than the operating system's GPU watchdog allows
// (Windows TDR, 2 s) and the device is lost. Measured 13 Nov 2026 on an AMD gcn-5 laptop GPU
// (about 43 prompt tokens per second), WebLLM alone, Qwen3 0.6B, a 600-word prompt: chunks of 1024
// and 256 lost the device in Chrome and Chromium alike; chunks of 64 answered (prefill 21 s). So
// 32 tokens, about 0.75 s of work, is the chunk that was measured to be safe for Qwen3 0.6B.
// The cost per token is not the same for every model. On 14 Nov 2026 the same laptop loaded
// Llama 3.2 3B, lost the device on its first question (the error text was "Object has already
// been disposed", see model-errors.ts), and could not answer again: a 3B model costs about six
// times as much per token as the 0.6B one, so 32 tokens ran for about 4.5 s. The limit is
// therefore a table with one value per model, scaled from the measured one: a model's chunk is
// 32 tokens times the 248 MB of non-embedding weights of Qwen3 0.6B, divided by the model's own
// (the matrix work done for every token; the embedding table is a lookup). The megabytes are the
// sums of the non-embedding records in each repository's tensor-cache.json at the pinned
// revision, read on 14 Nov 2026: Qwen3 0.6B 248, Llama 3.2 3B 1586, Qwen3.5 2B 773, Gemma 4 E2B
// 1249 (Gemma's per-layer embeddings are lookups and are left out). The scaled values are
// estimates, not measurements: change the table when a run on a real GPU says otherwise.
// The pipeline keeps the chunk size as a plain field, read at every prefill, so a smaller value
// after the load keeps every chunk short. The cost on a fast GPU is more sync points, well under a
// second on a long prompt. The field is WebLLM's own (LLMChatPipeline.prefillChunkSize,
// @mlc-ai/web-llm 0.2.86); when a later version drops it nothing is changed and the limit is
// reported as not applied.

/** Tokens per chunk measured safe for Qwen3 0.6B on the laptop GPU. */
export const MEASURED_CHUNK = 32;

/** The floor: below 4 tokens a chunk is a pass that is bound by reading the weights, as in
 *  decoding, so its time stops falling and a smaller chunk only adds sync points. */
export const MIN_CHUNK = 4;

/** Tokens per prefill chunk after a load, by model id (the scaling is in the comment above). */
export const PREFILL_CHUNKS: Readonly<Record<string, number>> = {
  'Qwen3-0.6B-q4f16_1-MLC': 32,
  'Llama-3.2-3B-Instruct-q4f16_1-MLC': 5,
  'Qwen3.5-2B-q4f16_1-MLC': 10,
  'gemma-4-E2B-it-q4f16_1-MLC': 6,
};

/** The chunk for a model: its table value, never below the floor; for an id that is not in the
 *  table, the smallest value there. */
export function chunkFor(modelId: string): number {
  const smallest = Math.min(...Object.values(PREFILL_CHUNKS));
  return Math.max(MIN_CHUNK, PREFILL_CHUNKS[modelId] ?? smallest);
}

interface PipelineLike {
  prefillChunkSize?: unknown;
}

/** The part of MLCEngine this touches: its loaded pipelines by model id. */
export interface EngineWithPipelines {
  loadedModelIdToPipeline?: Map<string, PipelineLike>;
}

/** A fixed size for every model, or a function of the model id. */
export type ChunkSize = number | ((modelId: string) => number);

/** Sets the chunk size on every loaded pipeline (the size `size` gives for its model id; the
 *  table value by default); returns how many pipelines took it. */
export function limitPrefillChunk(engine: EngineWithPipelines, size: ChunkSize = chunkFor): number {
  let applied = 0;
  for (const [modelId, pipeline] of engine.loadedModelIdToPipeline ?? []) {
    if (typeof pipeline.prefillChunkSize !== 'number') continue;
    const wanted = typeof size === 'number' ? size : size(modelId);
    if (pipeline.prefillChunkSize > wanted) pipeline.prefillChunkSize = wanted;
    applied += 1;
  }
  return applied;
}

interface Reloadable {
  reload(...args: never[]): Promise<void>;
}

/** Makes every reload of `engine` end with the limit (the host's MLCEngine, in a Worker or not;
 *  the pipelines field is private to MLCEngine's type, so it is read through EngineWithPipelines). */
export function limitAfterReload<E extends Reloadable>(engine: E, size: ChunkSize = chunkFor): E {
  const target = engine as unknown as EngineWithPipelines & {
    reload(...args: unknown[]): Promise<void>;
  };
  const reload = target.reload.bind(target);
  target.reload = async (...args: unknown[]): Promise<void> => {
    await reload(...args);
    limitPrefillChunk(target, size);
  };
  return engine;
}
