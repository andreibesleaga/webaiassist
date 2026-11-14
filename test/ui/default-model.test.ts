// SPDX-License-Identifier: Apache-2.0
// The default model is chosen by what is on this computer and by one measurement; the user's own
// choice always wins and is kept (features/02-choosing-a-model.feature).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { chooseDefault, whyFor } from '../../src/ui/default-model';
import type { PickerEnv } from '../../src/ui/model-picker';

const QWEN = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
const CPU = 'cpu:qwen3-0.6b-q4_k_m';
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
      expect(chooseDefault(DEFAULT_SETTINGS, env).value).toBe(CPU);
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

  it('is the processor model when the graphics card is slow, unmeasured or missing', () => {
    const slow = { ...base, gpuMeasure: { speed: 'slow' as const, firstAnswerMs: 40_000 } };
    expect(chooseDefault(DEFAULT_SETTINGS, slow)).toMatchObject({ value: CPU, why: 'whyCpu' });
    expect(chooseDefault(DEFAULT_SETTINGS, base).value).toBe(CPU);
    expect(chooseDefault(DEFAULT_SETTINGS, { ...base, webgpu: false }).value).toBe(CPU);
  });

  it('says how much memory the processor model uses', () => {
    expect(chooseDefault(DEFAULT_SETTINGS, base).values).toEqual({ size: 800 });
  });

  it('falls back to the graphics card when the processor model cannot run here', () => {
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
    expect(chooseDefault(withEndpoint, base).value).toBe(CPU);
  });
});

describe('why the model is selected', () => {
  it('gives the reason of the default while the settings are automatic', () => {
    expect(whyFor(DEFAULT_SETTINGS, base, CPU)).toMatchObject({ why: 'whyCpu' });
  });

  it('says "you chose this model" for a saved choice, even when it equals the default', () => {
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'cpu' as const };
    expect(whyFor(chosen, base, CPU).why).toBe('whyChosen');
    expect(whyFor(DEFAULT_SETTINGS, base, QWEN).why).toBe('whyChosen');
  });

  it('labels the test model and the set-up entry', () => {
    expect(whyFor(DEFAULT_SETTINGS, base, 'scripted').why).toBe('whyTest');
    expect(whyFor(DEFAULT_SETTINGS, base, 'setup-endpoint').why).toBe('whySetup');
  });
});
