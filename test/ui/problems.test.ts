// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { classifyProblem, errorDetails, NoGpuError } from '../../src/ui/problems';

describe('classifyProblem', () => {
  it('tells the failures a user can act on by their words', () => {
    expect(
      classifyProblem(new NoGpuError('This browser has no usable graphics acceleration')),
    ).toBe('no-gpu');
    expect(
      classifyProblem(new Error('Object has already been disposed (DXGI_ERROR_DEVICE_REMOVED)')),
    ).toBe('device-lost');
    expect(classifyProblem(new Error('The GPU device was lost'))).toBe('device-lost');
    expect(classifyProblem(new Error('Error: Object has already been disposed'))).toBe(
      'device-lost',
    );
    expect(classifyProblem(new Error('The model stopped. Press Start to load it again.'))).toBe(
      'model-stopped',
    );
    expect(classifyProblem(new Error('QuotaExceededError: the quota has been exceeded'))).toBe(
      'no-space',
    );
    const quota = Object.assign(new Error('write failed'), { name: 'QuotaExceededError' });
    expect(classifyProblem(quota)).toBe('no-space');
    expect(classifyProblem(new Error('There is no space left on the device'))).toBe('no-space');
    expect(classifyProblem(new Error('The endpoint answered 401.'))).toBe('endpoint-refused');
    expect(classifyProblem(new Error('The endpoint answered 403. Ollama refuses'))).toBe(
      'endpoint-refused',
    );
    expect(classifyProblem(new Error('The endpoint answered 500.'))).toBe('unexpected');
    expect(classifyProblem(new Error('boom'))).toBe('unexpected');
    expect(classifyProblem('plain text')).toBe('unexpected');
  });
});

describe('errorDetails', () => {
  it('holds the version and the message, cut short, and nothing else', () => {
    expect(errorDetails('0.1.0', new Error('boom'))).toBe('WebAIAssist 0.1.0\nboom');
    expect(errorDetails('0.1.0', new Error('x'.repeat(900)))).toHaveLength(
      'WebAIAssist 0.1.0\n'.length + 500,
    );
  });
});
