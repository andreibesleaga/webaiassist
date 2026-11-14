// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { LoadProgress } from '../../src/core/ports/model-runtime';
import { engineAppears, LARGE, newDisk, noProgress, setup, SMALL, small } from './wllama-fakes';

describe('WllamaRuntime load', () => {
  it('downloads the model once, checks its SHA-256, remembers it, loads it and reports progress', async () => {
    const { runtime, engines, disk } = setup();
    const progress: LoadProgress[] = [];
    await runtime.load(SMALL, (p) => progress.push(p));
    const [engine] = engines;
    expect(engine?.downloads).toEqual([small.url]);
    expect(engine?.hashed).toEqual([small.url]);
    expect(engine?.loads).toEqual([small.url]);
    expect(disk.checked.get(small.url)).toBe(small.sha256);
    const fractions = progress.map((p) => p.fraction);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    expect(progress.some((p) => /198 of 397 MB/.test(p.text))).toBe(true);
    expect(progress.at(-1)).toEqual({ fraction: 1, text: 'Ready' });
    expect(runtime.where()).toBe('cpu:4');
  });

  it('starts from the stored copy without a download or a new hash when it was checked before', async () => {
    const first = setup();
    await first.runtime.load(SMALL, noProgress);
    const second = setup(first.disk);
    await second.runtime.load(SMALL, noProgress);
    expect(second.engines[0]?.downloads).toEqual([]);
    expect(second.engines[0]?.hashed).toEqual([]);
    expect(second.engines[0]?.loads).toEqual([small.url]);
  });

  it('checks a stored copy that was never checked, then uses it without a download', async () => {
    const disk = newDisk();
    disk.files.set(small.url, small.bytes);
    disk.hashes.set(small.url, small.sha256);
    const { runtime, engines } = setup(disk);
    await runtime.load(SMALL, noProgress);
    expect(engines[0]?.downloads).toEqual([]);
    expect(engines[0]?.hashed).toEqual([small.url]);
    expect(disk.checked.get(small.url)).toBe(small.sha256);
  });

  it('deletes a stored copy whose SHA-256 differs, says so, and the next Start downloads a fresh one', async () => {
    const disk = newDisk();
    disk.files.set(small.url, small.bytes);
    disk.hashes.set(small.url, 'f'.repeat(64));
    const first = setup(disk);
    await expect(first.runtime.load(SMALL, noProgress)).rejects.toThrow(/did not match/);
    expect(disk.files.has(small.url)).toBe(false);
    expect(first.engines[0]?.downloads).toEqual([]);
    const second = setup(disk);
    await second.runtime.load(SMALL, noProgress);
    expect(second.engines[0]?.downloads).toEqual([small.url]);
  });

  it('deletes a partial stored file and downloads again', async () => {
    const disk = newDisk();
    disk.files.set(small.url, 1000);
    const { runtime, engines } = setup(disk);
    await runtime.load(SMALL, noProgress);
    expect(engines[0]?.downloads).toEqual([small.url]);
    expect(disk.files.get(small.url)).toBe(small.bytes);
  });

  it('refuses and deletes a download with the wrong SHA-256, and the next Start downloads again', async () => {
    const bad = setup(
      newDisk(),
      (e) => (e.serves = { bytes: small.bytes, sha256: 'e'.repeat(64) }),
    );
    await expect(bad.runtime.load(SMALL, noProgress)).rejects.toThrow(
      /did not match its checksum and was deleted/,
    );
    expect(bad.disk.files.has(small.url)).toBe(false);
    expect(bad.disk.checked.has(small.url)).toBe(false);
    expect(bad.engines[0]?.loads).toEqual([]);
    expect(bad.engines[0]?.exited).toBe(1);
    const again = setup(bad.disk);
    await again.runtime.load(SMALL, noProgress);
    expect(again.engines[0]?.downloads).toEqual([small.url]);
  });

  it('refuses a download whose size is not the recorded size', async () => {
    const disk = newDisk();
    const { runtime } = setup(disk, (e) => (e.serves = { bytes: 1000, sha256: small.sha256 }));
    await expect(runtime.load(SMALL, noProgress)).rejects.toThrow(
      /did not match its checksum and was deleted/,
    );
    expect(disk.files.has(small.url)).toBe(false);
  });

  it('keeps no partial file when the connection drops, says why, and the next Start downloads again', async () => {
    const disk = newDisk();
    const first = setup(disk, (e) => (e.failDownloadWith = new Error('network error')));
    await expect(first.runtime.load(SMALL, noProgress)).rejects.toThrow(
      /The download stopped: network error/,
    );
    expect(disk.files.has(small.url)).toBe(false);
    const second = setup(disk);
    await second.runtime.load(SMALL, noProgress);
    expect(second.engines[0]?.downloads).toEqual([small.url]);
    expect(second.engines[0]?.loads).toEqual([small.url]);
  });

  it('says the browser has no space, with the size, when storing the file is refused', async () => {
    const disk = newDisk();
    const full = Object.assign(new Error('The quota has been exceeded.'), {
      name: 'QuotaExceededError',
    });
    const { runtime } = setup(disk, (e) => (e.failDownloadWith = full));
    await expect(runtime.load(SMALL, noProgress)).rejects.toThrow(
      /The browser has no space to store Qwen3 0\.6B on the processor \(397 MB\)\. Remove downloaded models in Options/,
    );
    expect(disk.files.has(small.url)).toBe(false);
  });

  it('shows the share of the download that has arrived, in megabytes and percent', async () => {
    const { runtime } = setup();
    const texts: string[] = [];
    await runtime.load(SMALL, (p) => texts.push(p.text));
    expect(texts).toContain('Downloading Qwen3 0.6B on the processor: 198 of 397 MB (50%)');
  });

  it('cancel ends the download at once, deletes the partial file and loads nothing', async () => {
    const disk = newDisk();
    const { runtime, engines } = setup(disk, (e) => (e.holdDownload = true));
    const cancel = new AbortController();
    const loading = runtime.load(SMALL, noProgress, cancel.signal);
    const engine = await engineAppears(engines);
    cancel.abort();
    await expect(loading).rejects.toThrow('The download was cancelled.');
    expect(disk.files.has(small.url)).toBe(false);
    expect(engine.loads).toEqual([]);
    expect(engine.exited).toBe(1);
  });

  it('does nothing when it is cancelled before it starts', async () => {
    const { runtime, engines } = setup();
    const cancel = new AbortController();
    cancel.abort();
    await expect(runtime.load(SMALL, noProgress, cancel.signal)).rejects.toThrow(/cancelled/);
    expect(engines[0]?.downloads ?? []).toEqual([]);
  });

  it('answers at once to Cancel while the model loads into memory, and frees it afterwards', async () => {
    const disk = newDisk();
    disk.files.set(small.url, small.bytes);
    disk.hashes.set(small.url, small.sha256);
    disk.checked.set(small.url, small.sha256);
    let release: () => void = () => {};
    const { runtime, engines } = setup(disk, (e) => {
      e.holdLoad = new Promise<void>((resolve) => (release = resolve));
    });
    const cancel = new AbortController();
    const loading = runtime.load(SMALL, noProgress, cancel.signal);
    await engineAppears(engines);
    await new Promise((resolve) => setTimeout(resolve, 5));
    cancel.abort();
    await expect(loading).rejects.toThrow('The download was cancelled.');
    release();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(engines[0]?.exited).toBe(1);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow('No model is loaded.');
  });

  it('names the memory needed and the next step when the computer is out of memory', async () => {
    const { runtime, engines } = setup(
      newDisk(),
      (e) => (e.failLoadWith = new RangeError('WebAssembly.Memory(): could not allocate memory')),
    );
    const error = await runtime.load(SMALL, noProgress).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(error?.message).toMatch(/about 800 MB of free memory/);
    expect(error?.message).toMatch(/Close other tabs or choose the smaller model/);
    expect(engines[0]?.exited).toBe(1);
  });

  it('passes any other load failure on as it is', async () => {
    const { runtime } = setup(
      newDisk(),
      (e) => (e.failLoadWith = new Error('unsupported architecture')),
    );
    await expect(runtime.load(SMALL, noProgress)).rejects.toThrow('unsupported architecture');
  });

  it('refuses a model that is not in the list, before it creates an engine', async () => {
    const { runtime, engines } = setup();
    await expect(runtime.load('../evil', noProgress)).rejects.toThrow(
      /not one of the models this version ships/,
    );
    await expect(runtime.load('Qwen3-0.6B-q4f16_1-MLC', noProgress)).rejects.toThrow(/not one of/);
    expect(engines).toEqual([]);
  });

  it('does not load again what is loaded, and frees the old model before another', async () => {
    const { runtime, engines } = setup();
    await runtime.load(SMALL, noProgress);
    const progress: LoadProgress[] = [];
    await runtime.load(SMALL, (p) => progress.push(p));
    expect(engines).toHaveLength(1);
    expect(progress).toEqual([{ fraction: 1, text: 'Ready' }]);
    await runtime.load(LARGE, noProgress);
    expect(engines).toHaveLength(2);
    expect(engines[0]?.exited).toBe(1);
  });
});
