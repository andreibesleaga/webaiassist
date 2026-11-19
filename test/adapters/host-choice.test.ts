// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { chooseHost } from '../../src/adapters/host-choice';
import type { GpuReport } from '../../src/protocol/messages';

const yes: GpuReport = { available: true, adapter: true, features: [], limits: {} };
const no = (error: string): GpuReport => ({
  available: true,
  adapter: false,
  features: [],
  limits: {},
  error,
});

describe('chooseHost', () => {
  it('picks the offscreen document first (the host measured on 12 Nov 2026)', async () => {
    const asked: string[] = [];
    const host = await chooseHost((target) => {
      asked.push(target);
      return Promise.resolve(yes);
    });
    expect(host).toEqual({ host: 'offscreen', notes: [] });
    expect(asked).toEqual(['offscreen']);
  });

  it('never uses the service worker: with no adapter in the offscreen document it says why', async () => {
    const asked: string[] = [];
    const host = await chooseHost((target) => {
      asked.push(target);
      return Promise.resolve(no('no adapter'));
    });
    expect(host).toEqual({ host: 'none', notes: ['offscreen document: no adapter'] });
    expect(asked).toEqual(['offscreen']);
  });

  it('reports none when the probe throws', async () => {
    const host = await chooseHost(() => Promise.reject(new Error('closed')));
    expect(host).toEqual({ host: 'none', notes: ['offscreen document: closed'] });
  });

  it('notes a report with no adapter and no error text', async () => {
    const plain: GpuReport = { available: false, adapter: false, features: [], limits: {} };
    const host = await chooseHost(() => Promise.resolve(plain));
    expect(host.notes).toEqual(['offscreen document: no WebGPU']);
  });
});
