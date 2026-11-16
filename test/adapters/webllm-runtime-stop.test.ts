// SPDX-License-Identifier: Apache-2.0
// Stop on a graphics-card model that does not stop: WebLLM reads its interrupt between two pieces
// of GPU work, and a model too slow for the card can stay inside one piece for minutes. Five
// seconds after Stop the engine is ended (in a Worker: terminated) and let go, so the next Start
// loads again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_STOPPED } from '../../src/adapters/model-errors';
import {
  STOP_GRACE_MS,
  WebLlmRuntime,
  type WebLlmChunk,
  type WebLlmEngineLike,
} from '../../src/adapters/webllm-runtime';

const QWEN = 'Qwen3-0.6B-q4f16_1-MLC';
const ask = { messages: [{ role: 'user' as const, content: 'hi' }] };

/** An engine whose reply never ends, or ends when `finish` is called. */
class SlowEngine implements WebLlmEngineLike {
  interrupted = 0;
  killed = 0;
  unloaded = 0;
  finish: (() => void) | undefined;
  readonly chat = {
    completions: {
      create: (): Promise<AsyncIterable<WebLlmChunk>> => {
        const done = new Promise<void>((resolve) => (this.finish = resolve));
        async function* chunks(): AsyncIterable<WebLlmChunk> {
          await done;
          yield { choices: [{ delta: { content: 'late' } }] };
        }
        return Promise.resolve(chunks());
      },
    },
  };
  interruptGenerate(): void {
    this.interrupted += 1;
  }
  kill(): void {
    this.killed += 1;
  }
  unload(): Promise<void> {
    this.unloaded += 1;
    return Promise.resolve();
  }
}

async function loaded(engine: SlowEngine, loads: string[] = []): Promise<WebLlmRuntime> {
  const runtime = new WebLlmRuntime((modelId) => {
    loads.push(modelId);
    return Promise.resolve(engine);
  });
  await runtime.load(QWEN, () => undefined);
  return runtime;
}

describe('Stop on a graphics-card model', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => vi.useRealTimers());

  it('ends an engine that is still running five seconds after Stop, and the next Start loads again', async () => {
    const engine = new SlowEngine();
    const loads: string[] = [];
    const runtime = await loaded(engine, loads);
    const abort = new AbortController();
    const caught = runtime
      .chat({ ...ask, signal: abort.signal })
      .catch((error: unknown) => error as Error);
    abort.abort();
    expect(engine.interrupted).toBe(1);
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS - 1);
    expect(engine.killed).toBe(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(((await caught) as Error).message).toBe(MODEL_STOPPED);
    expect(engine.killed).toBe(1);
    expect(engine.unloaded).toBe(1);
    await expect(runtime.chat(ask)).rejects.toThrow(/No model is loaded/);
    await runtime.load(QWEN, () => undefined);
    expect(loads).toEqual([QWEN, QWEN]);
  });

  it('keeps an engine that stops in time', async () => {
    const engine = new SlowEngine();
    const runtime = await loaded(engine);
    const abort = new AbortController();
    const answer = runtime.chat({ ...ask, signal: abort.signal });
    await vi.advanceTimersByTimeAsync(0);
    abort.abort();
    engine.finish?.();
    expect(await answer).toBe('late');
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + 10);
    expect(engine.killed).toBe(0);
    expect(engine.unloaded).toBe(0);
    expect(runtime.where()).toBeUndefined();
  });

  it('ends the engine when Stop was pressed before the reply began', async () => {
    const engine = new SlowEngine();
    const runtime = await loaded(engine);
    const abort = new AbortController();
    abort.abort();
    const caught = runtime
      .chat({ ...ask, signal: abort.signal })
      .catch((error: unknown) => error as Error);
    expect(engine.interrupted).toBe(1);
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + 1);
    expect(((await caught) as Error).message).toBe(MODEL_STOPPED);
    expect(engine.killed).toBe(1);
  });

  it('leaves an idle engine alone when Stop comes after the reply ended', async () => {
    const engine = new SlowEngine();
    const runtime = await loaded(engine);
    const abort = new AbortController();
    const answer = runtime.chat({ ...ask, signal: abort.signal });
    await vi.advanceTimersByTimeAsync(0);
    engine.finish?.();
    expect(await answer).toBe('late');
    abort.abort();
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + 10);
    expect(engine.interrupted).toBe(0);
    expect(engine.killed).toBe(0);
  });

  it('still ends an engine whose interrupt throws', async () => {
    const engine = new SlowEngine();
    engine.interruptGenerate = () => {
      throw new Error('disposed');
    };
    const runtime = await loaded(engine);
    const abort = new AbortController();
    const caught = runtime
      .chat({ ...ask, signal: abort.signal })
      .catch((error: unknown) => error as Error);
    abort.abort();
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + 1);
    expect(((await caught) as Error).message).toBe(MODEL_STOPPED);
    expect(engine.killed).toBe(1);
  });

  it('an engine that cannot be killed (main thread): the next Start waits for its unload', async () => {
    const engine = new SlowEngine();
    let unloaded: (() => void) | undefined;
    const plain: WebLlmEngineLike = {
      chat: engine.chat,
      interruptGenerate: () => undefined,
      unload: () => new Promise<void>((resolve) => (unloaded = resolve)),
    };
    const loads: string[] = [];
    const runtime = new WebLlmRuntime((modelId) => {
      loads.push(modelId);
      return Promise.resolve(plain);
    });
    await runtime.load(QWEN, () => undefined);
    const abort = new AbortController();
    const caught = runtime.chat({ ...ask, signal: abort.signal }).catch(() => undefined);
    abort.abort();
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + 1);
    await caught;
    const again = runtime.load(QWEN, () => undefined);
    await vi.advanceTimersByTimeAsync(10);
    expect(loads).toEqual([QWEN]);
    const cancel = new AbortController();
    const waiting = runtime.load(QWEN, () => undefined, cancel.signal);
    cancel.abort(); // Cancel while it waits: the wait ends, nothing loads
    await expect(waiting).rejects.toThrow(/cancelled/);
    await expect(again).rejects.toThrow(/cancelled/); // a newer Start cancels the older one
    const third = runtime.load(QWEN, () => undefined);
    unloaded?.();
    await third;
    expect(loads).toEqual([QWEN, QWEN]);
  });

  it('never ends an engine nobody stopped, however long the reply takes', async () => {
    const engine = new SlowEngine();
    const runtime = await loaded(engine);
    const answer = runtime.chat(ask);
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS * 100);
    expect(engine.killed).toBe(0);
    engine.finish?.();
    expect(await answer).toBe('late');
  });
});
