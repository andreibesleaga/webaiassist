// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { CPU_MODELS, type CpuModel } from '../../src/adapters/cpu-models';
import {
  bytesUnder,
  cpuBackend,
  isStored,
  ModelStore,
  webllmBackend,
  type CacheLike,
} from '../../src/adapters/model-store';
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

const QWEN = 'Qwen3-0.6B-q4f16_1-MLC';

function webllmFiles(sizes: Record<string, number>, removed: string[]) {
  return {
    has: (id: string) => Promise.resolve(id in sizes),
    size: (id: string) => Promise.resolve(sizes[id] ?? 0),
    remove: (id: string) => {
      removed.push(id);
      delete sizes[id];
      return Promise.resolve();
    },
  };
}

describe('model store', () => {
  it('lists the processor models whose complete file is stored, with their sizes', async () => {
    const files = new Map([
      [SMALL.url, SMALL.bytes],
      [LARGE.url, 1000],
    ]);
    const list = await cpuBackend(engine(files), CPU_MODELS).list();
    expect(list).toEqual([
      { runtime: 'cpu', id: SMALL.id, name: 'Qwen3 0.6B on the processor', bytes: SMALL.bytes },
    ]);
  });

  it('removes a processor model file', async () => {
    const files = new Map([[SMALL.url, SMALL.bytes]]);
    await cpuBackend(engine(files), CPU_MODELS).remove(SMALL.id);
    expect(files.size).toBe(0);
  });

  it('lists the graphics-card models that WebLLM has in its cache', async () => {
    const removed: string[] = [];
    const backend = webllmBackend(webllmFiles({ [QWEN]: 351_517_143 }, removed));
    expect(await backend.list()).toEqual([
      { runtime: 'webllm', id: QWEN, name: 'Qwen3 0.6B on the graphics card', bytes: 351_517_143 },
    ]);
    await backend.remove(QWEN);
    expect(removed).toEqual([QWEN]);
    expect(await backend.list()).toEqual([]);
  });

  it('puts every backend into one list, removes one model or all, and counts what was freed', async () => {
    const files = new Map([[SMALL.url, SMALL.bytes]]);
    const sizes: Record<string, number> = { [QWEN]: 1000 };
    const store = new ModelStore([
      webllmBackend(webllmFiles(sizes, [])),
      cpuBackend(engine(files), CPU_MODELS),
    ]);
    const all = await store.list();
    expect(all.map((m) => m.id)).toEqual([QWEN, SMALL.id]);
    expect(isStored(all, 'cpu', SMALL.id)).toBe(true);
    expect(isStored(all, 'cpu', LARGE.id)).toBe(false);
    await store.remove('cpu', SMALL.id);
    expect(files.size).toBe(0);
    expect(await store.removeAll()).toEqual({ count: 1, bytes: 1000 });
    expect(await store.list()).toEqual([]);
  });

  it('does not let one backend that fails hide the others', async () => {
    const broken = {
      runtime: 'webllm' as const,
      list: () => Promise.reject(new Error('no cache here')),
      remove: () => Promise.resolve(),
    };
    const files = new Map([[SMALL.url, SMALL.bytes]]);
    const store = new ModelStore([broken, cpuBackend(engine(files), CPU_MODELS)]);
    expect((await store.list()).map((m) => m.id)).toEqual([SMALL.id]);
  });

  it('knows the download size of each graphics-card model (read from Hugging Face on 14 Nov 2026)', () => {
    expect(WEBLLM_DOWNLOADS[QWEN]).toBe(351_517_143);
    expect(WEBLLM_DOWNLOADS['Llama-3.2-3B-Instruct-q4f16_1-MLC']).toBe(1_816_811_105);
    expect(WEBLLM_DOWNLOADS['Qwen3.5-2B-q4f16_1-MLC']).toBe(1_072_298_012);
    expect(WEBLLM_DOWNLOADS['gemma-4-E2B-it-q4f16_1-MLC']).toBe(2_830_391_017);
  });

  it('lists and removes the two newer graphics-card models and the new processor model too', async () => {
    const ids = ['Qwen3.5-2B-q4f16_1-MLC', 'gemma-4-E2B-it-q4f16_1-MLC'];
    const removed: string[] = [];
    const sizes = Object.fromEntries(ids.map((id) => [id, 1000]));
    const files = new Map([[CPU_MODELS[2]!.url, CPU_MODELS[2]!.bytes]]);
    const store = new ModelStore([
      webllmBackend(webllmFiles(sizes, removed)),
      cpuBackend(engine(files), CPU_MODELS),
    ]);
    expect((await store.list()).map((m) => m.name)).toEqual([
      'Qwen3.5 2B on the graphics card',
      'Gemma 4 E2B on the graphics card',
      'Qwen3.5 2B on the processor',
    ]);
    await store.removeAll();
    expect(removed).toEqual(ids);
    expect(files.size).toBe(0);
  });
});

describe('bytesUnder', () => {
  const entry = (url: string, length: number | null, blobSize = 5) =>
    ({
      url,
      response: {
        headers: { get: () => (length === null ? null : String(length)) },
        blob: () => Promise.resolve({ size: blobSize }),
      },
    }) as const;

  function cacheOf(entries: ReturnType<typeof entry>[]): CacheLike {
    return {
      keys: () => Promise.resolve(entries.map((e) => ({ url: e.url }))),
      match: (request: { url: string }) =>
        Promise.resolve(entries.find((e) => e.url === request.url)?.response),
    };
  }

  it('adds up the entries under one address, from the length header or the stored size', async () => {
    const cache = cacheOf([
      entry('https://h/a/p0.bin', 100),
      entry('https://h/a/p1.bin', null, 40),
      entry('https://h/b/p0.bin', 999),
    ]);
    expect(await bytesUnder(cache, 'https://h/a/')).toBe(140);
    expect(await bytesUnder(cache, 'https://h/none/')).toBe(0);
  });
});
