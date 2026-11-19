// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { CPU_MODELS, LOCAL_FILES, type CpuModel } from '../../src/adapters/cpu-models';
import { cpuBackend, isStored, ModelStore } from '../../src/adapters/model-store';
import { WEBLLM_DOWNLOADS } from '../../src/adapters/models';
import type { WllamaEngineLike } from '../../src/adapters/wllama-runtime';

const [SMALL, LARGE] = CPU_MODELS as [CpuModel, CpuModel];

/** An engine that knows only the two calls the store uses. */
function engine(files: Map<string, number>): WllamaEngineLike {
  return {
    storedBytes: (url: string) => Promise.resolve(files.get(url) ?? -1),
    remove: (url: string) => {
      files.delete(url);
      return Promise.resolve();
    },
  } as unknown as WllamaEngineLike;
}

describe('model store', () => {
  it('lists the models whose complete file is stored, with their sizes and plain names', async () => {
    const files = new Map([
      [SMALL.url, SMALL.bytes],
      [LARGE.url, 1000],
    ]);
    const list = await cpuBackend(engine(files), CPU_MODELS).list();
    expect(list).toEqual([
      { runtime: 'cpu', id: SMALL.id, name: 'Qwen3 0.6B', bytes: SMALL.bytes },
    ]);
  });

  it('removes a model file', async () => {
    const files = new Map([[SMALL.url, SMALL.bytes]]);
    await cpuBackend(engine(files), CPU_MODELS).remove(SMALL.id);
    expect(files.size).toBe(0);
  });

  it('lists a model offered on both devices once, and the graphics-card-only models too', async () => {
    const files = new Map(LOCAL_FILES.map((m) => [m.url, m.bytes]));
    const list = await cpuBackend(engine(files), LOCAL_FILES).list();
    expect(list.map((m) => m.name)).toEqual([
      'Qwen3 0.6B',
      'Qwen3 1.7B',
      'Qwen3.5 2B',
      'Llama 3.2 3B',
      'Gemma 4 E2B',
    ]);
  });

  it('puts the backends into one list, removes one model or all, and counts what was freed', async () => {
    const files = new Map([[SMALL.url, SMALL.bytes]]);
    const store = new ModelStore([cpuBackend(engine(files), CPU_MODELS)]);
    const all = await store.list();
    expect(all.map((m) => m.id)).toEqual([SMALL.id]);
    expect(isStored(all, SMALL.id)).toBe(true);
    expect(isStored(all, LARGE.id)).toBe(false);
    expect(await store.removeAll()).toEqual({ count: 1, bytes: SMALL.bytes });
    expect(files.size).toBe(0);
    expect(await store.list()).toEqual([]);
  });

  it('does not let one backend that fails hide the others', async () => {
    const broken = {
      runtime: 'cpu' as const,
      list: () => Promise.reject(new Error('no file storage here')),
      remove: () => Promise.resolve(),
    };
    const files = new Map([[SMALL.url, SMALL.bytes]]);
    const store = new ModelStore([broken, cpuBackend(engine(files), CPU_MODELS)]);
    expect((await store.list()).map((m) => m.id)).toEqual([SMALL.id]);
  });

  it('knows the download size of each graphics-card model: the size of its file', () => {
    expect(WEBLLM_DOWNLOADS['qwen3-0.6b-q4_k_m']).toBe(396_705_472);
    expect(WEBLLM_DOWNLOADS['llama-3.2-3b-instruct-q4_k_m']).toBe(2_019_377_600);
    expect(WEBLLM_DOWNLOADS['qwen3.5-2b-q4_k_m']).toBe(1_280_835_840);
    expect(WEBLLM_DOWNLOADS['gemma-4-e2b-it-q4_k_m']).toBe(3_106_738_272);
  });
});
