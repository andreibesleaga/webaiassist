// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { findCpuModel } from '../../src/adapters/cpu-models';
import { WllamaRuntime } from '../../src/adapters/wllama-runtime';
import { createFakeEngine, smokeCpuModels } from '../../src/fakes/fake-wllama-engine';

const runtime = (): WllamaRuntime => new WllamaRuntime(createFakeEngine, smokeCpuModels());
const noProgress = (): void => {};

beforeEach(() => {
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
});

describe('the smoke-build fake engine, through the real runtime', () => {
  it('lists the five test models and keeps them out of the real list', () => {
    expect(smokeCpuModels().map((m) => m.id)).toEqual([
      'smoke-cpu',
      'smoke-cpu-bad-sum',
      'smoke-cpu-drop',
      'smoke-cpu-big',
      'smoke-cpu-full',
    ]);
    expect(findCpuModel('smoke-cpu')).toBeUndefined();
  });

  it('downloads once, answers, and starts from the stored copy afterwards', async () => {
    const texts: string[] = [];
    const first = runtime();
    await first.load('smoke-cpu', (p) => texts.push(p.text));
    expect(texts.some((t) => t.startsWith('Downloading'))).toBe(true);
    expect(await first.chat({ messages: [{ role: 'user', content: 'hello' }] })).toContain(
      'Processor model reply to: hello',
    );
    const again: string[] = [];
    await runtime().load('smoke-cpu', (p) => again.push(p.text));
    expect(again.some((t) => t.startsWith('Downloading'))).toBe(false);
  });

  it('refuses the file with the wrong checksum, deletes it, and downloads again', async () => {
    await expect(runtime().load('smoke-cpu-bad-sum', noProgress)).rejects.toThrow(
      /did not match its checksum and was deleted/,
    );
    const again: string[] = [];
    await expect(runtime().load('smoke-cpu-bad-sum', (p) => again.push(p.text))).rejects.toThrow();
    expect(again.some((t) => t.startsWith('Downloading'))).toBe(true);
  });

  it('drops once half way, keeps nothing, then succeeds', async () => {
    await expect(runtime().load('smoke-cpu-drop', noProgress)).rejects.toThrow(
      /The download stopped: the connection was lost/,
    );
    await expect(runtime().load('smoke-cpu-drop', noProgress)).resolves.toBeUndefined();
  });

  it('has no space for the full one, and stores nothing', async () => {
    await expect(runtime().load('smoke-cpu-full', noProgress)).rejects.toThrow(
      /The browser has no space to store Smoke CPU model that needs a free disk \(1 MB\)/,
    );
    const stored = await createFakeEngine().storedBytes(smokeCpuModels()[4]?.url ?? '');
    expect(stored).toBe(-1);
  });

  it('runs out of memory for the big one', async () => {
    await expect(runtime().load('smoke-cpu-big', noProgress)).rejects.toThrow(
      /free memory.*Close other tabs/,
    );
  });
});
