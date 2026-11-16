// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
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
  it('ships four WebLLM models, the small one first, the two slow ones last', () => {
    expect(WEBLLM_MODEL_IDS).toEqual([
      'Qwen3-0.6B-q4f16_1-MLC',
      'Qwen3.5-2B-q4f16_1-MLC',
      'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      'gemma-4-E2B-it-q4f16_1-MLC',
    ]);
    const choices = modelChoices({ promptApi: false });
    expect(choices.map((c) => c.id)).toEqual(WEBLLM_MODEL_IDS);
    expect(choices.every((c) => c.runtime === 'webllm' && /GB/.test(c.label))).toBe(true);
  });

  it('says in plain words what each newer model is for, its size and its licence', () => {
    const label = (id: string): string => findModel(id)?.label ?? '';
    expect(label('Qwen3.5-2B-q4f16_1-MLC')).toMatch(
      /^Qwen3\.5 2B \(.*2\.3 GB of GPU memory.*Apache-2\.0\)$/,
    );
    expect(label('gemma-4-E2B-it-q4f16_1-MLC')).toMatch(
      /^Gemma 4 E2B \(.*3\.4 GB of GPU memory.*Apache-2\.0\)$/,
    );
  });

  it('marks Llama 3.2 3B and Gemma 4 E2B as slow, and neither is ever the default', () => {
    const label = (id: string): string => findModel(id)?.label ?? '';
    for (const id of ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'gemma-4-E2B-it-q4f16_1-MLC']) {
      expect(label(id)).toContain('slow: may stall');
      expect(id).not.toBe(defaultModelId());
    }
    expect(label('Qwen3-0.6B-q4f16_1-MLC')).not.toContain('slow');
    expect(label('Qwen3.5-2B-q4f16_1-MLC')).not.toContain('slow');
  });

  it('says what the slow models need: Llama 3.2 3B memory, Gemma 4 E2B download and memory', () => {
    const label = (id: string): string => findModel(id)?.label ?? '';
    expect(label('Llama-3.2-3B-Instruct-q4f16_1-MLC')).toMatch(
      /^Llama 3\.2 3B \(slow: .*2\.3 GB of GPU memory\)$/,
    );
    expect(label('gemma-4-E2B-it-q4f16_1-MLC')).toMatch(
      /^Gemma 4 E2B \(slow: .*2\.8 GB download.*3\.4 GB of GPU memory.*Apache-2\.0\)$/,
    );
  });

  it('leaves the model that needs shader-f16 out only when the card is known to lack it', () => {
    const ids = (f: boolean | undefined): string[] => webllmChoices(f).map((m) => m.id);
    expect(ids(false)).toEqual(WEBLLM_MODEL_IDS.filter((id) => !id.startsWith('gemma')));
    expect(ids(true)).toEqual(WEBLLM_MODEL_IDS);
    expect(ids(undefined)).toEqual(WEBLLM_MODEL_IDS);
  });

  it('marks the one model that needs the shader-f16 feature of the graphics card', () => {
    const needs = modelChoices({ promptApi: false }).filter((m) => m.requiredFeature);
    expect(needs.map((m) => [m.id, m.requiredFeature])).toEqual([
      ['gemma-4-E2B-it-q4f16_1-MLC', 'shader-f16'],
    ]);
  });

  it('knows the download size of every graphics-card model, read from the pinned revisions', () => {
    expect(Object.keys(WEBLLM_DOWNLOADS)).toEqual([...WEBLLM_MODEL_IDS]);
    expect(WEBLLM_DOWNLOADS['Llama-3.2-3B-Instruct-q4f16_1-MLC']).toBe(1_816_811_105);
    expect(WEBLLM_DOWNLOADS['Qwen3.5-2B-q4f16_1-MLC']).toBe(1_072_298_012);
    expect(WEBLLM_DOWNLOADS['gemma-4-E2B-it-q4f16_1-MLC']).toBe(2_830_391_017);
  });

  it('defaults to the small bundled model on every GPU', () => {
    expect(defaultModelId()).toBe('Qwen3-0.6B-q4f16_1-MLC');
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
