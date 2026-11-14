// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { gpuKey, gpuSpeed, SLOW_FIRST_ANSWER_MS } from '../../src/adapters/gpu-speed';

describe('gpu speed', () => {
  it('calls a first answer slow above 20 seconds; the owner’s laptop (40 s) is slow', () => {
    expect(SLOW_FIRST_ANSWER_MS).toBe(20_000);
    const key = 'amd/gcn-5';
    expect(gpuSpeed({ key, firstAnswerMs: 40_000 }, key)).toBe('slow');
    expect(gpuSpeed({ key, firstAnswerMs: 20_001 }, key)).toBe('slow');
    expect(gpuSpeed({ key, firstAnswerMs: 20_000 }, key)).toBe('fast');
    expect(gpuSpeed({ key, firstAnswerMs: 3_500 }, key)).toBe('fast');
  });

  it('knows nothing without a measurement, or for another graphics card', () => {
    expect(gpuSpeed(undefined, 'amd/gcn-5')).toBeUndefined();
    expect(gpuSpeed({ key: 'amd/gcn-5', firstAnswerMs: 40_000 }, 'nvidia/ada')).toBeUndefined();
    expect(gpuSpeed({ key: 'amd/gcn-5', firstAnswerMs: 40_000 }, undefined)).toBeUndefined();
  });

  it('names the adapter from the probe report, and nothing when the report has no names', () => {
    expect(gpuKey({ vendor: 'amd', architecture: 'gcn-5' })).toBe('amd/gcn-5');
    expect(gpuKey({ vendor: 'amd' })).toBe('amd/');
    expect(gpuKey({})).toBeUndefined();
  });
});
