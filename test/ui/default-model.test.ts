// SPDX-License-Identifier: Apache-2.0
// The default model is chosen by what is on this computer and by one measurement; the user's own
// choice always wins and is kept (features/02-choosing-a-model.feature).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { chooseDefault, whyFor } from '../../src/ui/default-model';
import type { PickerEnv } from '../../src/ui/model-picker';

const QWEN = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
const CPU = 'cpu:qwen3-1.7b-q4_k_m';
const base: PickerEnv = { promptApi: false, scripted: false, webgpu: true, cpu: true };
const withEndpoint = {
  ...DEFAULT_SETTINGS,
  endpoint: { ...DEFAULT_SETTINGS.endpoint, model: 'qwen3:0.6b' },
};

describe('the default model', () => {
  it('is Chrome’s built-in model when Chrome says it is available', () => {
    const env = { ...base, promptApi: true, builtIn: 'available' as const };
    expect(chooseDefault(DEFAULT_SETTINGS, env)).toMatchObject({
      value: 'prompt-api',
      why: 'whyBuiltIn',
    });
  });

  it('is not Chrome’s built-in model while it still has to download', () => {
    for (const builtIn of ['downloadable', 'downloading', 'unavailable', 'unknown'] as const) {
      const env = { ...base, promptApi: true, builtIn };
      expect(chooseDefault(DEFAULT_SETTINGS, env).value).toBe(QWEN);
    }
  });

  it('is the graphics-card model when its measured first answer was not slow', () => {
    const env = { ...base, gpuMeasure: { speed: 'fast' as const, firstAnswerMs: 12_400 } };
    expect(chooseDefault(DEFAULT_SETTINGS, env)).toMatchObject({
      value: QWEN,
      why: 'whyGpu',
      values: { seconds: 12 },
    });
  });

  it('is the graphics card even when its first answer was slow, with the slow reason', () => {
    const slow = { ...base, gpuMeasure: { speed: 'slow' as const, firstAnswerMs: 40_000 } };
    expect(chooseDefault(DEFAULT_SETTINGS, slow)).toMatchObject({
      value: QWEN,
      why: 'whyGpuSlow',
      values: { seconds: 40 },
    });
  });

  it('is the graphics card when WebGPU works and nothing was measured yet', () => {
    expect(chooseDefault(DEFAULT_SETTINGS, base)).toMatchObject({
      value: QWEN,
      why: 'whyGpuOnly',
    });
    expect(chooseDefault(DEFAULT_SETTINGS, { ...base, webgpu: undefined }).value).toBe(QWEN);
  });

  it('is the processor model only when WebGPU does not work', () => {
    const noGpu = { ...base, webgpu: false };
    expect(chooseDefault(DEFAULT_SETTINGS, noGpu)).toMatchObject({ value: CPU, why: 'whyCpu' });
    const slow = { ...noGpu, gpuMeasure: { speed: 'slow' as const, firstAnswerMs: 40_000 } };
    expect(chooseDefault(DEFAULT_SETTINGS, slow).value).toBe(CPU);
  });

  it('says how much memory the processor model uses (Qwen3 1.7B)', () => {
    expect(chooseDefault(DEFAULT_SETTINGS, { ...base, webgpu: false }).values).toEqual({
      size: 1500,
    });
  });

  it('stays on the graphics card when the processor model cannot run here', () => {
    const noCpu = { ...base, cpu: false };
    expect(chooseDefault(DEFAULT_SETTINGS, noCpu)).toMatchObject({
      value: QWEN,
      why: 'whyGpuOnly',
    });
    expect(chooseDefault(DEFAULT_SETTINGS, { ...noCpu, cpu: undefined }).value).toBe(QWEN);
  });

  it('then the endpoint when one is set, then Chrome’s built-in model, then the set-up', () => {
    const none = { ...base, cpu: false, webgpu: false };
    expect(chooseDefault(withEndpoint, none)).toMatchObject({
      value: 'endpoint',
      why: 'whyEndpoint',
      values: { host: 'localhost:11434' },
    });
    expect(chooseDefault(DEFAULT_SETTINGS, { ...none, promptApi: true })).toMatchObject({
      value: 'prompt-api',
      why: 'whyBuiltInLast',
    });
    expect(chooseDefault(DEFAULT_SETTINGS, none)).toMatchObject({
      value: 'setup-endpoint',
      why: 'whySetup',
    });
  });

  it('never picks the endpoint while a local model can run', () => {
    expect(chooseDefault(withEndpoint, base).value).toBe(QWEN);
    expect(chooseDefault(withEndpoint, { ...base, webgpu: false }).value).toBe(CPU);
  });
});

describe('why the model is selected', () => {
  it('gives the reason of the default while the settings are automatic', () => {
    expect(whyFor(DEFAULT_SETTINGS, base, QWEN)).toMatchObject({ why: 'whyGpuOnly' });
    const noGpu = { ...base, webgpu: false };
    expect(whyFor(DEFAULT_SETTINGS, noGpu, CPU)).toMatchObject({ why: 'whyCpu' });
  });

  it('says "you chose this model" for a saved choice, even when it equals the default', () => {
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'webllm' as const };
    expect(whyFor(chosen, base, QWEN).why).toBe('whyChosen');
    expect(whyFor(DEFAULT_SETTINGS, base, CPU).why).toBe('whyChosen');
  });

  it('labels the test model and the set-up entry', () => {
    expect(whyFor(DEFAULT_SETTINGS, base, 'scripted').why).toBe('whyTest');
    // The same entry with other models that can run here is the plain way into the set-up.
    expect(whyFor(DEFAULT_SETTINGS, base, 'setup-endpoint').why).toBe('whySetupOwn');
    const nothing = { promptApi: false, scripted: false, webgpu: false };
    expect(whyFor(DEFAULT_SETTINGS, nothing, 'setup-endpoint').why).toBe('whySetup');
  });
});
