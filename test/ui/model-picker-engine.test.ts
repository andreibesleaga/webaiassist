// SPDX-License-Identifier: Apache-2.0
// The models in the browser share one engine. A browser that cannot run it (older than Chrome
// 137) lists none of them, on the graphics card or on the processor.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import {
  pickerChoices,
  selectedValue,
  SETUP_VALUE,
  type PickerEnv,
} from '../../src/ui/model-picker';

const env: PickerEnv = { promptApi: false, scripted: false, webgpu: true };
const QWEN17 = 'qwen3-1.7b-q4_k_m';

describe('a browser that cannot run the local engine', () => {
  it('lists no model in the browser, on either device', () => {
    const none = pickerChoices(DEFAULT_SETTINGS, { ...env, cpu: false });
    expect(none.map((c) => c.value)).toEqual([SETUP_VALUE]);
  });

  it('does not keep a saved graphics-card model selected, and keeps it where the engine runs', () => {
    const saved = { ...DEFAULT_SETTINGS, runtime: 'webllm' as const, webllmModel: QWEN17 };
    expect(selectedValue(saved, { ...env, cpu: false })).not.toBe(`webllm:${QWEN17}`);
    expect(selectedValue(saved, { ...env, cpu: true })).toBe(`webllm:${QWEN17}`);
  });

  it('still lists the graphics-card models while the engine check has not answered', () => {
    const unknown = pickerChoices(DEFAULT_SETTINGS, env).filter((c) => c.runtime === 'webllm');
    expect(unknown).toHaveLength(5);
  });
});
