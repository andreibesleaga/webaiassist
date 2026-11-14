// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  askWorker,
  isProbe,
  placeEngine,
  PROBE,
  probeReply,
  type WorkerLike,
} from '../../src/adapters/worker-gpu-probe';

/** A Worker whose other end answers the probe with `reply` (or never, when undefined). */
class FakeWorker implements WorkerLike {
  readonly posted: unknown[] = [];
  private listener: ((event: { data: unknown }) => void) | undefined;
  removed = 0;
  constructor(private readonly reply?: () => Promise<unknown>) {}
  postMessage(message: unknown): void {
    this.posted.push(message);
    void this.reply?.().then((data) => {
      this.listener?.({ data: { type: 'other' } });
      this.listener?.({ data });
    });
  }
  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
    this.listener = listener;
  }
  removeEventListener(): void {
    this.removed += 1;
  }
}

const gpu = (adapter: unknown) => ({ requestAdapter: () => Promise.resolve(adapter) });

describe('WebGPU probe inside the model Worker', () => {
  it('recognises only its own probe message', () => {
    expect(isProbe({ type: PROBE })).toBe(true);
    expect(isProbe({ type: 'x' })).toBe(false);
    expect(isProbe(null)).toBe(false);
  });

  it('answers yes with an adapter, no without one or without navigator.gpu', async () => {
    expect(await probeReply(gpu({}))).toMatchObject({ adapter: true });
    expect(await probeReply(gpu(null))).toMatchObject({ adapter: false, why: 'no adapter' });
    expect(await probeReply(undefined)).toMatchObject({ adapter: false, why: 'no navigator.gpu' });
    const failing = { requestAdapter: () => Promise.reject(new Error('lost')) };
    expect(await probeReply(failing)).toMatchObject({ adapter: false, why: 'lost' });
  });

  it('asks the Worker and reads its reply', async () => {
    const worker = new FakeWorker(() => probeReply(gpu(null)));
    expect(await askWorker(worker, 1000)).toEqual({ adapter: false, why: 'no adapter' });
    expect(worker.posted).toEqual([{ type: PROBE }]);
    expect(worker.removed).toBe(1);
  });

  it('counts a Worker that does not answer in time as having no adapter', async () => {
    const result = await askWorker(new FakeWorker(), 5);
    expect(result).toEqual({ adapter: false, why: 'the Worker did not answer in 5 ms' });
  });
});

describe('placeEngine', () => {
  const make = (where: string) => () => Promise.resolve({ where });

  it('runs in the Worker when the Worker has an adapter', async () => {
    const placed = await placeEngine({
      probe: () => Promise.resolve({ adapter: true }),
      inWorker: make('w'),
      onMain: make('m'),
    });
    expect(placed).toEqual({ engine: { where: 'w' }, where: 'offscreen-worker' });
  });

  it('runs on the document’s main thread when the Worker has none (the measured path)', async () => {
    const placed = await placeEngine({
      probe: () => Promise.resolve({ adapter: false, why: 'no adapter' }),
      inWorker: make('w'),
      onMain: make('m'),
    });
    expect(placed).toEqual({ engine: { where: 'm' }, where: 'offscreen-main' });
  });
});
