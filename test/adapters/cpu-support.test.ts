// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { cpuRuntimeSupport } from '../../src/adapters/cpu-support';

const memory64 = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 4, 1]);

function engine(parts: { suspending?: boolean; mem64?: boolean }) {
  return {
    ...(parts.suspending === false ? {} : { Suspending: class {} }),
    validate: (bytes: BufferSource) =>
      parts.mem64 !== false && new Uint8Array(bytes as ArrayBuffer).join() === memory64.join(),
  };
}

describe('cpuRuntimeSupport', () => {
  it('is supported with promise integration and 64-bit memory', () => {
    expect(cpuRuntimeSupport(engine({}))).toEqual({ supported: true });
  });

  it('says what is missing, naming Chrome 137 for promise integration', () => {
    const result = cpuRuntimeSupport(engine({ suspending: false }));
    expect(result.supported).toBe(false);
    expect(result).toMatchObject({ why: expect.stringMatching(/Chrome 137/) as string });
  });

  it('says what is missing when 64-bit memory is not there', () => {
    expect(cpuRuntimeSupport(engine({ mem64: false }))).toMatchObject({
      supported: false,
      why: expect.stringMatching(/64-bit memory/) as string,
    });
  });

  it('is not supported without WebAssembly at all', () => {
    expect(cpuRuntimeSupport(undefined).supported).toBe(false);
  });
});
