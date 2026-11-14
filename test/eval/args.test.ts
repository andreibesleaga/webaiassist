// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { MODEL_IDS, parseEvalArgs } from '../../scripts/eval/args.ts';

describe('eval command line', () => {
  it('defaults to both models, all prompts, 10 idle minutes, headed Chrome', () => {
    expect(parseEvalArgs([])).toEqual({
      models: ['qwen', 'llama'],
      prompts: 20,
      idleMinutes: 10,
      scripted: false,
      headless: false,
      channel: 'chromium',
      live: true,
      cancelCheck: true,
      freshProfile: false,
      outDir: 'docs/eval',
      evalMd: 'docs/EVAL.md',
      promptTimeoutS: 300,
      startTimeoutMin: 20,
    });
  });

  it('takes the quick-smoke options', () => {
    const args = parseEvalArgs(['--models', 'qwen', '--prompts', '3', '--idle', '1']);
    expect(args).toMatchObject({ models: ['qwen'], prompts: 3, idleMinutes: 1 });
  });

  it('takes the two newer graphics-card models, and the default stays qwen and llama', () => {
    expect(parseEvalArgs([]).models).toEqual(['qwen', 'llama']);
    expect(parseEvalArgs(['--models', 'qwen35,gemma4']).models).toEqual(['qwen35', 'gemma4']);
    expect(MODEL_IDS.qwen35).toBe('Qwen3.5-2B-q4f16_1-MLC');
    expect(MODEL_IDS.gemma4).toBe('gemma-4-E2B-it-q4f16_1-MLC');
  });

  it('runs the scripted model in headless Chromium for the flow check', () => {
    const args = parseEvalArgs(['--scripted', '--headless', '--no-live', '--out', '/tmp/x']);
    expect(args).toMatchObject({
      models: ['scripted'],
      scripted: true,
      headless: true,
      channel: 'chromium',
      live: false,
      outDir: '/tmp/x',
    });
  });

  it('refuses unknown models and bad numbers', () => {
    expect(() => parseEvalArgs(['--models', 'gpt'])).toThrow(/unknown model "gpt"/);
    expect(() => parseEvalArgs(['--prompts', '0'])).toThrow(/--prompts must be 1 to 20/);
    expect(() => parseEvalArgs(['--idle=-1'])).toThrow(/--idle must be 0 or more/);
    expect(() => parseEvalArgs(['--bogus'])).toThrow();
  });
});
