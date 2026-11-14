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

  it('falls back to the service worker and says why', async () => {
    const host = await chooseHost((target) =>
      Promise.resolve(target === 'offscreen' ? no('no adapter') : yes),
    );
    expect(host).toEqual({ host: 'worker', notes: ['offscreen document: no adapter'] });
  });

  it('reports none when neither has WebGPU, including a probe that throws', async () => {
    const host = await chooseHost((target) =>
      target === 'offscreen' ? Promise.reject(new Error('closed')) : Promise.resolve(no('x')),
    );
    expect(host).toEqual({
      host: 'none',
      notes: ['offscreen document: closed', 'service worker: x'],
    });
  });

  it('notes a report with no adapter and no error text', async () => {
    const plain: GpuReport = { available: false, adapter: false, features: [], limits: {} };
    const host = await chooseHost(() => Promise.resolve(plain));
    expect(host.notes).toEqual(['offscreen document: no WebGPU', 'service worker: no WebGPU']);
  });
});
