// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { probeWebGpu } from '../../src/adapters/webgpu-probe';

const limits = {
  maxBufferSize: 4294967296,
  maxStorageBufferBindingSize: 2147483648,
  maxComputeWorkgroupStorageSize: 32768,
  maxComputeInvocationsPerWorkgroup: 1024,
};

const adapter = {
  features: new Set(['shader-f16', 'timestamp-query']),
  limits,
  info: { vendor: 'example-vendor', architecture: 'example-arch', isFallbackAdapter: false },
};

describe('probeWebGpu', () => {
  it('reports no WebGPU when navigator.gpu is missing', async () => {
    expect(await probeWebGpu(undefined)).toEqual({
      available: false,
      adapter: false,
      features: [],
      limits: {},
    });
  });

  it('reports a missing adapter', async () => {
    const report = await probeWebGpu({ requestAdapter: () => Promise.resolve(null) });
    expect(report).toEqual({
      available: true,
      adapter: false,
      features: [],
      limits: {},
      error: 'requestAdapter() returned null',
    });
  });

  it('reports an adapter with its features, limits and info', async () => {
    const report = await probeWebGpu({ requestAdapter: () => Promise.resolve(adapter) });
    expect(report).toEqual({
      available: true,
      adapter: true,
      features: ['shader-f16', 'timestamp-query'],
      limits,
      vendor: 'example-vendor',
      architecture: 'example-arch',
      fallback: false,
    });
  });

  it('reads only the listed limits and skips missing ones', async () => {
    const small = { features: new Set<string>(), limits: { maxBufferSize: 1, other: 5 } };
    const report = await probeWebGpu({ requestAdapter: () => Promise.resolve(small) });
    expect(report.limits).toEqual({ maxBufferSize: 1 });
    expect(report.vendor).toBeUndefined();
  });

  it('reports a thrown error as text', async () => {
    const report = await probeWebGpu({
      requestAdapter: () => Promise.reject(new Error('GPU lost')),
    });
    expect(report).toMatchObject({ available: true, adapter: false, error: 'Error: GPU lost' });
  });
});
