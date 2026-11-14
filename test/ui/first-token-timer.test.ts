// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { ChatRequest, ModelRuntime } from '../../src/core/ports/model-runtime';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { timeFirstToken } from '../../src/ui/first-token-timer';

/** A model that waits `delay` on the fake clock before its first token, then streams two. */
function slowModel(clock: { now: number }, delay: number): ModelRuntime {
  const model = new FakeModelRuntime([]);
  model.chat = (request: ChatRequest) => {
    clock.now += delay;
    request.onToken?.('{"ans');
    clock.now += 5;
    request.onToken?.('wer":"x"}');
    return Promise.resolve('{"answer":"x"}');
  };
  return model;
}

const chatOnce = (model: ModelRuntime): Promise<string> =>
  model.chat({ messages: [{ role: 'user', content: 'hi' }], onToken: () => undefined });

describe('timeFirstToken', () => {
  it('reports the wait for the first token of the first chat after a load, once', async () => {
    const clock = { now: 1000 };
    const seen: number[] = [];
    const model = timeFirstToken(
      slowModel(clock, 40_000),
      () => clock.now,
      (ms) => seen.push(ms),
    );
    expect(await chatOnce(model)).toBe('{"answer":"x"}');
    await chatOnce(model);
    expect(seen).toEqual([40_000]);
  });

  it('still hands every token to the caller', async () => {
    const clock = { now: 0 };
    const tokens: string[] = [];
    const model = timeFirstToken(
      slowModel(clock, 10),
      () => clock.now,
      () => undefined,
    );
    await model.chat({ messages: [], onToken: (token) => tokens.push(token) });
    expect(tokens).toEqual(['{"ans', 'wer":"x"}']);
  });

  it('reports nothing for a chat that failed before its first token', async () => {
    const seen: number[] = [];
    const broken = new FakeModelRuntime([]);
    broken.chat = () => Promise.reject(new Error('lost'));
    const model = timeFirstToken(
      broken,
      () => 0,
      (ms) => seen.push(ms),
    );
    await expect(chatOnce(model)).rejects.toThrow('lost');
    expect(seen).toEqual([]);
  });

  it('passes the other calls through', async () => {
    const inner = Object.assign(new FakeModelRuntime([]), { where: () => 'offscreen-worker' });
    const model = timeFirstToken(
      inner,
      () => 0,
      () => undefined,
    );
    expect(model.where?.()).toBe('offscreen-worker');
    expect(model.capabilities()).toEqual(inner.capabilities());
    await expect(model.unload()).resolves.toBeUndefined();
  });
});
