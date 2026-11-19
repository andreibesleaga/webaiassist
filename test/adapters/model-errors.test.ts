// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { DEVICE_LOST, MODEL_STOPPED } from '../../src/adapters/model-errors';

describe('the words of a lost graphics device', () => {
  it.each([
    'Failed to execute requestDevice: DXGI_ERROR_DEVICE_REMOVED (0x887A0005)',
    'The GPU device was lost',
    'Device has been lost',
    // What a laptop run showed on the first question of Llama 3.2 3B (14 Nov 2026, with the
    // engine of version 0.1.0): the device was lost, the engine freed its objects, and the call
    // in flight then read a freed one. The wording stays matched.
    'Error: Error: Object has already been disposed',
    'Tensor has already been disposed',
  ])('matches "%s"', (text) => {
    expect(DEVICE_LOST.test(text)).toBe(true);
  });

  it('does not match other failures', () => {
    for (const text of ['boom', 'The endpoint answered 500.', 'QuotaExceededError', 'No model']) {
      expect(DEVICE_LOST.test(text)).toBe(false);
    }
  });
});

describe('the words of an engine that is no longer loaded', () => {
  it('has one plain message that says what to do and none of the library text', () => {
    expect(MODEL_STOPPED).toBe('The model stopped. Press Start to load it again.');
    expect(DEVICE_LOST.test(MODEL_STOPPED)).toBe(false);
  });
});
