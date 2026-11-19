// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { GPU_MODELS } from '../../src/adapters/cpu-models';
import {
  defaultModelId,
  findModel,
  WEBLLM_DOWNLOADS,
  modelChoices,
  PROMPT_API_ID,
  WEBLLM_MODEL_IDS,
  webllmChoices,
} from '../../src/adapters/models';

describe('model choices', () => {
  it('ships five graphics-card models, the small one first, the two slow ones last', () => {
    expect(WEBLLM_MODEL_IDS).toEqual([
      'qwen3-0.6b-q4_k_m',
      'qwen3-1.7b-q4_k_m',
      'qwen3.5-2b-q4_k_m',
      'llama-3.2-3b-instruct-q4_k_m',
      'gemma-4-e2b-it-q4_k_m',
    ]);
    const choices = modelChoices({ promptApi: false });
    expect(choices.map((c) => c.id)).toEqual(WEBLLM_MODEL_IDS);
    expect(choices.every((c) => c.runtime === 'webllm' && /GB|MB/.test(c.label))).toBe(true);
  });

  it('says in plain words what each model is for, its size and its licence', () => {
    const label = (id: string): string => findModel(id)?.label ?? '';
    expect(label('qwen3.5-2b-q4_k_m')).toMatch(
      /^Qwen3\.5 2B \(.*on your graphics card.*1\.6 GB of GPU memory.*Apache-2\.0\)$/,
    );
    expect(label('gemma-4-e2b-it-q4_k_m')).toMatch(
      /^Gemma 4 E2B \(.*3\.5 GB of GPU memory.*Apache-2\.0\)$/,
    );
  });

  it('marks Gemma 4 E2B as slow, and neither it nor Llama 3.2 3B is ever the default', () => {
    const label = (id: string): string => findModel(id)?.label ?? '';
    expect(label('gemma-4-e2b-it-q4_k_m')).toContain('slow: may stall');
    for (const id of ['llama-3.2-3b-instruct-q4_k_m', 'gemma-4-e2b-it-q4_k_m']) {
      expect(id).not.toBe(defaultModelId());
    }
    for (const id of [
      'qwen3-0.6b-q4_k_m',
      'qwen3-1.7b-q4_k_m',
      'qwen3.5-2b-q4_k_m',
      'llama-3.2-3b-instruct-q4_k_m',
    ]) {
      expect(label(id)).not.toContain('slow');
    }
  });

  it('says what the two larger models need: download size, graphics memory and licence', () => {
    const label = (id: string): string => findModel(id)?.label ?? '';
    expect(label('llama-3.2-3b-instruct-q4_k_m')).toMatch(
      /^Llama 3\.2 3B \(larger, picks tools well; .*2\.0 GB download.*2\.4 GB of GPU memory; Llama 3\.2 Community License\)$/,
    );
    expect(label('gemma-4-e2b-it-q4_k_m')).toMatch(
      /^Gemma 4 E2B \(slow: .*3\.1 GB download.*3\.5 GB of GPU memory.*Apache-2\.0\)$/,
    );
  });

  it('lists every graphics-card model on every card: none needs shader-f16 any more', () => {
    const ids = (f: boolean | undefined): string[] => webllmChoices(f).map((m) => m.id);
    expect(ids(false)).toEqual(WEBLLM_MODEL_IDS);
    expect(ids(true)).toEqual(WEBLLM_MODEL_IDS);
    expect(ids(undefined)).toEqual(WEBLLM_MODEL_IDS);
    expect(modelChoices({ promptApi: false }).filter((m) => m.requiredFeature)).toEqual([]);
  });

  it('knows the download size of every graphics-card model: the size of its file', () => {
    expect(Object.keys(WEBLLM_DOWNLOADS)).toEqual([...WEBLLM_MODEL_IDS]);
    for (const model of GPU_MODELS) expect(WEBLLM_DOWNLOADS[model.id]).toBe(model.bytes);
    expect(WEBLLM_DOWNLOADS['llama-3.2-3b-instruct-q4_k_m']).toBe(2_019_377_600);
    expect(WEBLLM_DOWNLOADS['qwen3.5-2b-q4_k_m']).toBe(1_280_835_840);
    expect(WEBLLM_DOWNLOADS['gemma-4-e2b-it-q4_k_m']).toBe(3_106_738_272);
  });

  it('defaults to Qwen3 1.7B on every GPU', () => {
    expect(defaultModelId()).toBe('qwen3-1.7b-q4_k_m');
  });

  it("adds Chrome's built-in model only when the Prompt API is present, labelled optional", () => {
    const choices = modelChoices({ promptApi: true });
    expect(choices.at(-1)).toMatchObject({ id: PROMPT_API_ID, runtime: 'prompt-api' });
    expect(choices.at(-1)?.label).toMatch(/optional/);
    expect(choices.at(-1)?.label).toMatch(/only (when|if) you choose it/);
  });

  it('adds the scripted test model only in the smoke-test build', () => {
    expect(modelChoices({ promptApi: false, scripted: true }).at(-1)?.runtime).toBe('scripted');
  });

  it('finds a model by id', () => {
    expect(findModel(WEBLLM_MODEL_IDS[1] ?? '')?.runtime).toBe('webllm');
    expect(findModel('nope')).toBeUndefined();
  });
});
