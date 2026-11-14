// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { CPU_MODEL_IDS } from '../../src/adapters/cpu-models';
import { cpuChoice, cpuKey, CPU_KEYS } from '../../scripts/eval/cpu-run.ts';

describe('the --model choice of npm run eval:cpu', () => {
  it('names each listed processor model once, and selects it by its panel value', () => {
    expect(Object.values(CPU_KEYS)).toEqual([...CPU_MODEL_IDS]);
    expect(cpuChoice('0.6b')).toBe('cpu:qwen3-0.6b-q4_k_m');
    expect(cpuChoice('1.7b')).toBe('cpu:qwen3-1.7b-q4_k_m');
    expect(cpuChoice('qwen35-2b')).toBe('cpu:qwen3.5-2b-q4_k_m');
  });

  it('defaults to 0.6b and refuses a name it does not know', () => {
    expect(cpuKey(undefined)).toBe('0.6b');
    expect(cpuKey('qwen35-2b')).toBe('qwen35-2b');
    expect(() => cpuKey('9b')).toThrow(/unknown model "9b" \(0\.6b, 1\.7b, qwen35-2b\)/);
  });
});
