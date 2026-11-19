// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { GPU_MODELS } from '../../src/adapters/cpu-models';
import { GPU_GAVE_UP, GPU_PLACE } from '../../src/adapters/wllama-runtime';
import { newDisk, noProgress, setup, SMALL } from './wllama-fakes';

const LLAMA = 'llama-3.2-3b-instruct-q4_k_m';

describe('WllamaRuntime on the graphics card', () => {
  it('finds every graphics-card model and asks the engine to load it on the "gpu"', async () => {
    for (const model of GPU_MODELS) {
      const { runtime, engines } = setup(newDisk(), () => {}, 'gpu');
      await runtime.load(model.id, noProgress);
      expect(engines[0]?.loads).toEqual([model.url]);
      expect(engines[0]?.devices).toEqual(['gpu']);
    }
  });

  it('refuses a graphics-card-only model on a processor instance, before it creates an engine', async () => {
    const { runtime, engines } = setup();
    await expect(runtime.load(LLAMA, noProgress)).rejects.toThrow(/not one of the models/);
    expect(engines).toHaveLength(0);
  });

  it('reports the offscreen worker as the place after a load, and nothing before', async () => {
    const { runtime } = setup(newDisk(), () => {}, 'gpu');
    expect(runtime.where()).toBeUndefined();
    await runtime.load(SMALL, noProgress);
    expect(runtime.where()).toBe(GPU_PLACE);
    expect(GPU_PLACE).toBe('offscreen-worker');
  });

  it('says "graphics memory" when the card cannot hold the model, and "free memory" on the processor', async () => {
    const gpu = setup(newDisk(), (e) => (e.failLoadWith = new Error('Out of memory')), 'gpu');
    await expect(gpu.runtime.load(SMALL, noProgress)).rejects.toThrow(/MB of graphics memory/);
    const cpu = setup(newDisk(), (e) => (e.failLoadWith = new Error('Out of memory')));
    await expect(cpu.runtime.load(SMALL, noProgress)).rejects.toThrow(/MB of free memory/);
  });

  it('reports an engine that ended during the load on the card as a lost device', async () => {
    const { runtime } = setup(
      newDisk(),
      (e) => (e.failLoadWith = new Error('Aborted(). Build with -sASSERTIONS')),
      'gpu',
    );
    await expect(runtime.load(SMALL, noProgress)).rejects.toThrow(GPU_GAVE_UP);
  });

  it('still loads on the "cpu" on a processor instance and reports the threads', async () => {
    const { runtime, engines } = setup();
    await runtime.load(SMALL, noProgress);
    expect(engines[0]?.devices).toEqual(['cpu']);
    expect(runtime.where()).toBe('cpu:4');
  });
});
