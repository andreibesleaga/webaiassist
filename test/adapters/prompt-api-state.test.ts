// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  builtInState,
  explainChatFailure,
  explainFailure,
  hasPromptApi,
  quotaNumbers,
  stateReason,
  LANGUAGE_OPTIONS,
  readState,
} from '../../src/adapters/prompt-api-state';

const lm = (answer: () => Promise<string>) => ({ availability: answer });

describe('Chrome built-in model state', () => {
  it('is "absent" without LanguageModel and never starts a download', async () => {
    expect(await builtInState(undefined)).toBe('absent');
  });

  it('passes the same language options as create() and keeps the four known states', async () => {
    const seen: object[] = [];
    const fake = {
      availability: (options?: object) => {
        seen.push(options ?? {});
        return Promise.resolve('downloadable');
      },
    };
    expect(await builtInState(fake)).toBe('downloadable');
    expect(seen[0]).toEqual(LANGUAGE_OPTIONS);
    expect(await builtInState(lm(() => Promise.resolve('later-state')))).toBe('unknown');
    expect(await builtInState(lm(() => Promise.reject(new Error('x'))))).toBe('unknown');
  });

  it('reports a failing availability() with its reason', async () => {
    expect(await readState(lm(() => Promise.reject(new TypeError('bad options'))))).toBe(
      'unknown (TypeError: bad options)',
    );
    expect(await readState(lm(() => Promise.reject(new Error('plain'))))).toBe('unknown (plain)');
  });

  it('explains a plain failure without a fix line', () => {
    expect(explainFailure(new Error('gone'), 'available').message).toBe(
      "Chrome did not start its built-in model: gone (Chrome's state: available).",
    );
  });
});

describe('feature detection', () => {
  it('needs availability() and create(), not just a global of that name', () => {
    expect(hasPromptApi(undefined)).toBe(false);
    expect(hasPromptApi({})).toBe(false);
    expect(hasPromptApi({ availability: () => 1 })).toBe(false);
    expect(hasPromptApi({ availability: () => 1, create: () => 2 })).toBe(true);
  });
});

describe('a plain reason for each state', () => {
  it('tells what Chrome is doing, in words, for each state', () => {
    expect(stateReason('downloadable')).toMatch(/not on this computer.*starts the download/);
    expect(stateReason('downloading')).toMatch(/downloading/);
    expect(stateReason('available')).toMatch(/on this computer/);
    expect(stateReason('unavailable')).toMatch(/official Google Chrome.*22 GB free disk/s);
    expect(stateReason('unknown (x)')).toMatch(/Asking Chrome/);
  });

  it('names the official Chrome build and the 30-day removal as reported, not promised', () => {
    expect(stateReason('unavailable')).toMatch(/Users report.*30 days/);
  });
});

describe('failures of a question', () => {
  it('maps a language error to one plain line', () => {
    const error = new DOMException('Unsupported language ro', 'NotSupportedError');
    expect(explainChatFailure(error).message).toBe(
      'Chrome’s built-in model does not support this language; use a downloaded model.',
    );
  });

  it('reads the sizes of a quota error, and tolerates their absence', () => {
    const error = Object.assign(new DOMException('x', 'QuotaExceededError'), {
      requested: 12000,
      contextWindow: 9216,
    });
    expect(quotaNumbers(error)).toEqual({ requested: 12000, contextWindow: 9216 });
    expect(quotaNumbers(new DOMException('x', 'QuotaExceededError'))).toEqual({});
    expect(explainChatFailure(error).message).toMatch(/12000 tokens needed, 9216 fit/);
    expect(explainChatFailure(new DOMException('x', 'QuotaExceededError')).message).not.toMatch(
      /tokens needed/,
    );
  });

  it('keeps a cancel as a cancel, and names anything else', () => {
    const abort = new DOMException('stopped', 'AbortError');
    expect(explainChatFailure(abort)).toBe(abort);
    expect(explainChatFailure(new Error('boom')).message).toBe(
      "Chrome's built-in model failed: boom",
    );
  });
});
