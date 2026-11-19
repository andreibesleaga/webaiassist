// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_LOST, MODEL_STOPPED } from '../../src/adapters/model-errors';
import { GPU_GAVE_UP, STOP_GRACE_MS } from '../../src/adapters/wllama-runtime';
import { type FakeEngine, newDisk, noProgress, setup, SMALL } from './wllama-fakes';

type Device = 'cpu' | 'gpu';

async function loaded(device: Device = 'cpu') {
  const made = setup(newDisk(), () => {}, device);
  await made.runtime.load(SMALL, noProgress);
  return { ...made, engine: made.engines[0] as FakeEngine };
}

/** A stream that yields one piece and then never ends, whatever the signal does. */
function endless(): AsyncIterable<string> {
  return (async function* () {
    yield 'par';
    await new Promise<never>(() => undefined);
  })();
}

describe('Stop grace', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ends the engine and rejects with MODEL_STOPPED 5 s after Stop when the stream never ends', async () => {
    const { runtime, engine } = await loaded();
    engine.chat = () => Promise.resolve(endless());
    const stop = new AbortController();
    const result = runtime.chat({ messages: [], signal: stop.signal });
    const outcome = expect(result).rejects.toThrow(MODEL_STOPPED);
    await vi.advanceTimersByTimeAsync(100);
    stop.abort();
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS - 1);
    expect(engine.exited).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(STOP_GRACE_MS).toBe(5000);
    expect(engine.exited).toBe(1);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow('No model is loaded.');
    expect(runtime.where()).toBeUndefined();
  });

  it('returns the text so far and keeps the engine when the stream ends within the 5 s', async () => {
    const { runtime, engine } = await loaded();
    let finish: () => void = () => undefined;
    engine.chat = () =>
      Promise.resolve(
        (async function* () {
          yield 'par';
          await new Promise<void>((resolve) => (finish = resolve));
        })(),
      );
    const stop = new AbortController();
    const result = runtime.chat({ messages: [], signal: stop.signal });
    await vi.advanceTimersByTimeAsync(10);
    stop.abort();
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS - 1000);
    finish();
    await expect(result).resolves.toBe('par');
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS * 2);
    expect(engine.exited).toBe(0);
    expect(runtime.where()).toBe('cpu:4');
  });
});

describe('an engine that ended by itself', () => {
  const endings = ['(ABORT)', 'wllama has crashed, please reload the module'];

  it.each(endings)('says the graphics card gave up on "gpu" for "%s"', async (text) => {
    const { runtime, engine } = await loaded('gpu');
    engine.chat = () => Promise.reject(new Error(text));
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(GPU_GAVE_UP);
    expect(DEVICE_LOST.test(GPU_GAVE_UP)).toBe(true);
    expect(engine.exited).toBe(1);
  });

  it.each(endings)('says the model stopped on "cpu" for "%s"', async (text) => {
    const { runtime, engine } = await loaded('cpu');
    engine.chat = () => Promise.reject(new Error(text));
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(MODEL_STOPPED);
    expect(engine.exited).toBe(1);
  });

  it('reads the ending from a failure in the middle of the stream, too', async () => {
    const { runtime, engine } = await loaded('cpu');
    engine.chat = () =>
      Promise.resolve(
        (async function* () {
          yield 'par';
          await Promise.resolve();
          throw new Error('Aborted(native code called abort())');
        })(),
      );
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(MODEL_STOPPED);
  });

  it('loads the same model again for real afterwards, with a new engine', async () => {
    const { runtime, engine, engines } = await loaded('gpu');
    engine.chat = () => Promise.reject(new Error('(ABORT)'));
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(GPU_GAVE_UP);
    expect(runtime.where()).toBeUndefined();
    const seen: string[] = [];
    await runtime.load(SMALL, (p) => seen.push(p.text));
    expect(engines).toHaveLength(2);
    expect(engines[1]?.loads).toHaveLength(1);
    expect(runtime.where()).toBe('offscreen-worker');
    await expect(runtime.chat({ messages: [] })).resolves.toBe('{"answer":"hi"}');
  });

  it('rethrows any other error unchanged and keeps the model loaded', async () => {
    const { runtime, engine } = await loaded('gpu');
    const failure = new Error('kv cache full');
    engine.chat = () => Promise.reject(failure);
    await expect(runtime.chat({ messages: [] })).rejects.toBe(failure);
    expect(engine.exited).toBe(0);
    expect(runtime.where()).toBe('offscreen-worker');
  });
});
