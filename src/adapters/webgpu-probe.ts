// SPDX-License-Identifier: Apache-2.0
// Reads what WebGPU offers in one context (a page, the service worker, the offscreen
// document): whether an adapter exists, `shader-f16`, and the limits that decide which
// model fits. `gpu` is `navigator.gpu`, passed in so tests can use a fake.
import type { GpuReport } from '../protocol/messages';
import { errorText } from './webmcp-reader';

export interface GpuLike {
  requestAdapter(): Promise<unknown>;
}

interface AdapterLike {
  readonly features: Iterable<string>;
  readonly limits: Readonly<Record<string, unknown>>;
  readonly info?: { vendor?: string; architecture?: string; isFallbackAdapter?: boolean };
}

/** The limits that matter for running a model on the graphics card. */
export const LIMIT_NAMES = [
  'maxBufferSize',
  'maxStorageBufferBindingSize',
  'maxComputeWorkgroupStorageSize',
  'maxComputeInvocationsPerWorkgroup',
] as const;

const EMPTY = { features: [], limits: {} };

function readLimits(limits: Readonly<Record<string, unknown>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of LIMIT_NAMES) {
    const value = limits[name];
    if (typeof value === 'number') out[name] = value;
  }
  return out;
}

function describeAdapter(adapter: AdapterLike): GpuReport {
  const info = adapter.info ?? {};
  return {
    available: true,
    adapter: true,
    features: [...adapter.features].sort(),
    limits: readLimits(adapter.limits),
    ...(info.vendor !== undefined ? { vendor: info.vendor } : {}),
    ...(info.architecture !== undefined ? { architecture: info.architecture } : {}),
    ...(info.isFallbackAdapter !== undefined ? { fallback: info.isFallbackAdapter } : {}),
  };
}

export async function probeWebGpu(gpu: GpuLike | undefined): Promise<GpuReport> {
  if (!gpu) return { available: false, adapter: false, ...EMPTY };
  try {
    const adapter = (await gpu.requestAdapter()) as AdapterLike | null;
    if (!adapter) {
      return { available: true, adapter: false, ...EMPTY, error: 'requestAdapter() returned null' };
    }
    return describeAdapter(adapter);
  } catch (error) {
    return { available: true, adapter: false, ...EMPTY, error: errorText(error) };
  }
}
