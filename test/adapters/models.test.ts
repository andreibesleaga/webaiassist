// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  defaultModelId,
  findModel,
  WEBLLM_DOWNLOADS,
  modelChoices,
  PROMPT_API_ID,
  WEBLLM_MODEL_IDS,
} from '../../src/adapters/models';

describe('model choices', () => {
  it('ships four WebLLM models, the small one first, the two newer ones last', () => {
    expect(WEBLLM_MODEL_IDS).toEqual([
      'Qwen3-0.6B-q4f16_1-MLC',
      'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      'Qwen3.5-2B-q4f16_1-MLC',
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

  it('marks the one model that needs the shader-f16 feature of the graphics card', () => {
    const needs = modelChoices({ promptApi: false }).filter((m) => m.requiredFeature);
    expect(needs.map((m) => [m.id, m.requiredFeature])).toEqual([
      ['gemma-4-E2B-it-q4f16_1-MLC', 'shader-f16'],
    ]);
  });

  it('knows the download size of every graphics-card model, read from the pinned revisions', () => {
    expect(Object.keys(WEBLLM_DOWNLOADS)).toEqual([...WEBLLM_MODEL_IDS]);
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
