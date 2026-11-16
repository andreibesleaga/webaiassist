// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  CPU_MODELS,
  CPU_MODEL_IDS,
  defaultCpuModelId,
  findCpuModel,
} from '../../src/adapters/cpu-models';

describe('CPU model registry', () => {
  it('lists Qwen3 0.6B, Qwen3 1.7B and Qwen3.5 2B, nothing else, and defaults to Qwen3 1.7B', () => {
    expect(defaultCpuModelId()).toBe('qwen3-1.7b-q4_k_m');
    expect(CPU_MODEL_IDS).toEqual(['qwen3-0.6b-q4_k_m', 'qwen3-1.7b-q4_k_m', 'qwen3.5-2b-q4_k_m']);
  });

  it('pins each model to one commit of Hugging Face, a size and a SHA-256', () => {
    for (const model of CPU_MODELS) {
      expect(model.url).toMatch(
        /^https:\/\/huggingface\.co\/[\w.-]+\/[\w.-]+\/resolve\/[0-9a-f]{40}\/[\w.-]+\.gguf$/,
      );
      expect(model.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isInteger(model.bytes) && model.bytes > 100_000_000).toBe(true);
      expect(model.licence).toBe('Apache-2.0');
    }
  });

  it('records the sizes and hashes read from Hugging Face on 13 Nov 2026', () => {
    expect(findCpuModel('qwen3-0.6b-q4_k_m')).toMatchObject({
      bytes: 396_705_472,
      sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
    });
    expect(findCpuModel('qwen3-1.7b-q4_k_m')).toMatchObject({
      bytes: 1_107_409_472,
      sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
    });
  });

  it('records Qwen3.5 2B as read from Hugging Face on 14 Nov 2026 (the LFS object id is the SHA-256)', () => {
    expect(findCpuModel('qwen3.5-2b-q4_k_m')).toMatchObject({
      url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/f6d5376be1edb4d416d56da11e5397a961aca8ae/Qwen3.5-2B-Q4_K_M.gguf',
      bytes: 1_280_835_840,
      sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
      licence: 'Apache-2.0',
    });
  });

  it('tells the size, the memory and the licence of a model in its label', () => {
    expect(findCpuModel('qwen3-0.6b-q4_k_m')?.label).toMatch(/397 MB.*0\.8 GB.*Apache-2\.0/);
    expect(findCpuModel('qwen3-1.7b-q4_k_m')?.label).toMatch(/1\.1 GB.*1\.5 GB.*Apache-2\.0/);
    expect(findCpuModel('qwen3.5-2b-q4_k_m')?.label).toMatch(/1\.3 GB.*1\.7 GB.*Apache-2\.0/);
  });

  it('finds only listed ids, plus the extra ones a build passes in', () => {
    expect(findCpuModel('../evil')).toBeUndefined();
    const extra = [{ ...CPU_MODELS[0]!, id: 'extra' }];
    expect(findCpuModel('extra', extra)?.id).toBe('extra');
    expect(findCpuModel('extra')).toBeUndefined();
  });
});
