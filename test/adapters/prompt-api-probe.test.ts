// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { LANGUAGE_OPTIONS } from '../../src/adapters/prompt-api-state';
import { probePromptApi, type LanguageModelLike } from '../../src/adapters/prompt-api-probe';

function fake(availability: string, extra: Partial<LanguageModelLike> = {}): LanguageModelLike {
  return { availability: () => Promise.resolve(availability), ...extra };
}

describe('probePromptApi', () => {
  it('reports the API as absent', async () => {
    expect(await probePromptApi(undefined)).toEqual({ present: false });
  });

  it('asks availability() with the same language options create() gets', async () => {
    let seen: object | undefined;
    const lm = fake('downloadable', {
      availability: (options) => {
        seen = options;
        return Promise.resolve('downloadable');
      },
    });
    await probePromptApi(lm);
    expect(seen).toEqual(LANGUAGE_OPTIONS);
  });

  it('reports availability and params, and reads no session while the model is not there', async () => {
    const lm = fake('downloadable', {
      params: () => Promise.resolve({ defaultTopK: 3, maxTopK: 128 }),
      create: () => Promise.reject(new Error('must not be called')),
    });
    expect(await probePromptApi(lm)).toEqual({
      present: true,
      availability: 'downloadable',
      params: '{"defaultTopK":3,"maxTopK":128}',
      session: 'not read (model not available yet)',
    });
  });

  it('reads the window and the session functions when available, then destroys the session', async () => {
    let destroyed = false;
    let seen: object | undefined;
    const lm = fake('available', {
      create: (options) => {
        seen = options;
        return Promise.resolve({
          contextWindow: 9216,
          clone: () => undefined,
          destroy: () => (destroyed = true),
        });
      },
    });
    const report = await probePromptApi(lm);
    expect(report.session).toBe(
      'contextWindow 9216, inputQuota -, clone yes, measureContextUsage no',
    );
    expect(JSON.stringify(seen)).not.toContain('tools');
    expect(destroyed).toBe(true);
  });

  it('reports a create() that fails', async () => {
    const lm = fake('available', { create: () => Promise.reject(new TypeError('bad option')) });
    expect((await probePromptApi(lm)).session).toBe('create() failed: TypeError: bad option');
  });

  it('reports an availability() error', async () => {
    const lm = { availability: () => Promise.reject(new Error('blocked')) };
    expect(await probePromptApi(lm)).toEqual({ present: true, error: 'Error: blocked' });
  });
});
