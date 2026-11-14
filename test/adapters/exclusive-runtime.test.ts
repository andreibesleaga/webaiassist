// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { ExclusiveRuntime } from '../../src/adapters/exclusive-runtime';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';

class Counting extends FakeModelRuntime {
  unloads = 0;
  override unload(): Promise<void> {
    this.unloads += 1;
    return super.unload();
  }
}

describe('ExclusiveRuntime', () => {
  it('lets the other runtimes go before it loads, so two models never share the memory', async () => {
    const web = new Counting([]);
    const cpu = new Counting(['{"answer":"x"}']);
    const guarded = new ExclusiveRuntime(cpu, () => [web]);
    await guarded.load('m', () => {});
    expect(web.unloads).toBe(1);
    expect(cpu.loadedModel).toBe('m');
  });

  it('passes chat, unload, capabilities and where to the runtime it wraps', async () => {
    class Placed extends FakeModelRuntime {
      where(): string {
        return 'cpu:2';
      }
    }
    const inner = new Placed(['{"answer":"x"}']);
    const guarded = new ExclusiveRuntime(inner, () => []);
    await guarded.load('m', () => {});
    expect(await guarded.chat({ messages: [] })).toBe('{"answer":"x"}');
    expect(guarded.where()).toBe('cpu:2');
    expect(guarded.capabilities()).toEqual(inner.capabilities());
    await guarded.unload();
  });

  it('does not load when releasing the others fails', async () => {
    class Stuck extends FakeModelRuntime {
      override unload(): Promise<void> {
        return Promise.reject(new Error('stuck'));
      }
    }
    const inner = new Counting([]);
    const guarded = new ExclusiveRuntime(inner, () => [new Stuck([])]);
    await expect(guarded.load('m', () => {})).rejects.toThrow('stuck');
    expect(inner.loadedModel).toBeUndefined();
  });
});
