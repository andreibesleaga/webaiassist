// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { WEBLLM_MODEL_IDS } from '../../src/adapters/models';
import {
  chunkFor,
  limitAfterReload,
  limitPrefillChunk,
  MEASURED_CHUNK,
  MIN_CHUNK,
  PREFILL_CHUNKS,
} from '../../src/adapters/prefill-chunk';

const SMALL = 'Qwen3-0.6B-q4f16_1-MLC';
const LLAMA = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const QWEN35 = 'Qwen3.5-2B-q4f16_1-MLC';
const GEMMA = 'gemma-4-E2B-it-q4f16_1-MLC';

describe('the prefill chunk of each model', () => {
  it('has one value for every graphics-card model, and no other entry', () => {
    expect(Object.keys(PREFILL_CHUNKS).sort()).toEqual([...WEBLLM_MODEL_IDS].sort());
  });

  it('keeps the 32 tokens measured on the laptop GPU for Qwen3 0.6B', () => {
    expect(MEASURED_CHUNK).toBe(32);
    expect(chunkFor(SMALL)).toBe(32);
  });

  it('gives a model that costs more per token a smaller chunk, so one chunk runs about as long', () => {
    expect(chunkFor(LLAMA)).toBeLessThan(chunkFor(QWEN35));
    expect(chunkFor(QWEN35)).toBeLessThan(chunkFor(SMALL));
    expect(chunkFor(GEMMA)).toBeLessThan(chunkFor(SMALL));
    expect([chunkFor(LLAMA), chunkFor(QWEN35), chunkFor(GEMMA)]).toEqual([5, 10, 6]);
  });

  it('never goes below the floor, whatever a table entry says', () => {
    expect(MIN_CHUNK).toBe(4);
    for (const id of WEBLLM_MODEL_IDS) expect(chunkFor(id)).toBeGreaterThanOrEqual(MIN_CHUNK);
  });

  it('uses the smallest chunk for an id the table does not know', () => {
    expect(chunkFor('some-other-model')).toBe(Math.min(...Object.values(PREFILL_CHUNKS)));
  });
});

describe('prefill chunk limit', () => {
  it('lowers the chunk size of every loaded pipeline to the value of its model, never raises it', () => {
    const engine = {
      loadedModelIdToPipeline: new Map([
        [SMALL, { prefillChunkSize: 2048 }],
        [LLAMA, { prefillChunkSize: 1024 }],
        [GEMMA, { prefillChunkSize: 3 }],
      ]),
    };
    expect(limitPrefillChunk(engine)).toBe(3);
    const size = (id: string): unknown => engine.loadedModelIdToPipeline.get(id)?.prefillChunkSize;
    expect(size(SMALL)).toBe(32);
    expect(size(LLAMA)).toBe(5);
    expect(size(GEMMA)).toBe(3);
  });

  it('changes nothing when WebLLM no longer has the field', () => {
    expect(limitPrefillChunk({})).toBe(0);
    const odd = { loadedModelIdToPipeline: new Map([[SMALL, { prefillChunkSize: 'x' }]]) };
    expect(limitPrefillChunk(odd)).toBe(0);
    expect(odd.loadedModelIdToPipeline.get(SMALL)?.prefillChunkSize).toBe('x');
  });

  it('takes one size for every model (the GPU check tool), or a function of the model id', () => {
    const engine = { loadedModelIdToPipeline: new Map([[LLAMA, { prefillChunkSize: 1024 }]]) };
    limitPrefillChunk(engine, 128);
    expect(engine.loadedModelIdToPipeline.get(LLAMA)?.prefillChunkSize).toBe(128);
    limitPrefillChunk(engine, () => 64);
    expect(engine.loadedModelIdToPipeline.get(LLAMA)?.prefillChunkSize).toBe(64);
  });

  it('applies the limit after every reload of the engine, for the model that was loaded', async () => {
    const engine = {
      loadedModelIdToPipeline: new Map<string, { prefillChunkSize: number }>(),
      reload(modelId: string): Promise<void> {
        this.loadedModelIdToPipeline.set(modelId, { prefillChunkSize: 2048 });
        return Promise.resolve();
      },
    };
    limitAfterReload(engine);
    await engine.reload(GEMMA);
    expect(engine.loadedModelIdToPipeline.get(GEMMA)?.prefillChunkSize).toBe(6);
    await engine.reload(QWEN35);
    expect(engine.loadedModelIdToPipeline.get(QWEN35)?.prefillChunkSize).toBe(10);
  });
});
