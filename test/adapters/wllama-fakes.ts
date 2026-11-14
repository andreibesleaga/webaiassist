// SPDX-License-Identifier: Apache-2.0
// A fake llama.cpp engine and the set-up shared by the CPU runtime tests. No real engine is
// ever loaded, nothing is downloaded.
import { findCpuModel, type CpuModel } from '../../src/adapters/cpu-models';
import {
  WllamaRuntime,
  type WllamaChatRequest,
  type WllamaEngineLike,
} from '../../src/adapters/wllama-runtime';
import { items } from './runtime-helpers';

export const SMALL = 'qwen3-0.6b-q4_k_m';
export const LARGE = 'qwen3-1.7b-q4_k_m';
export const small = findCpuModel(SMALL) as CpuModel;

export interface Disk {
  /** url -> stored bytes (what the browser's storage holds). */
  readonly files: Map<string, number>;
  /** url -> the SHA-256 the stored bytes have. */
  readonly hashes: Map<string, string>;
  /** url -> the SHA-256 the runtime recorded after it checked the file. */
  readonly checked: Map<string, string>;
}

export const newDisk = (): Disk => ({ files: new Map(), hashes: new Map(), checked: new Map() });

export class FakeEngine implements WllamaEngineLike {
  readonly downloads: string[] = [];
  readonly loads: string[] = [];
  readonly requests: WllamaChatRequest[] = [];
  readonly hashed: string[] = [];
  exited = 0;
  /** What the next download stores: the real hash by default. */
  serves: { bytes: number; sha256: string } | undefined;
  failDownloadWith: Error | undefined;
  failLoadWith: Error | undefined;
  holdLoad: Promise<void> | undefined;
  holdDownload = false;
  pieces: string[] = ['{"answer":', '"hi"}'];

  constructor(readonly disk: Disk) {}

  storedBytes(url: string): Promise<number> {
    return Promise.resolve(this.disk.files.get(url) ?? -1);
  }

  async download(
    url: string,
    onProgress: (loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    this.downloads.push(url);
    const model = [findCpuModel(SMALL), findCpuModel(LARGE)].find((m) => m?.url === url);
    const served = this.serves ?? { bytes: model?.bytes ?? 0, sha256: model?.sha256 ?? '' };
    onProgress(served.bytes / 2, served.bytes);
    this.disk.files.set(url, served.bytes / 2);
    if (this.failDownloadWith) throw this.failDownloadWith;
    if (this.holdDownload) {
      await new Promise<void>((_, reject) =>
        signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      );
    }
    onProgress(served.bytes, served.bytes);
    this.disk.files.set(url, served.bytes);
    this.disk.hashes.set(url, served.sha256);
  }

  sha256(url: string): Promise<string> {
    this.hashed.push(url);
    return Promise.resolve(this.disk.hashes.get(url) ?? '');
  }

  remove(url: string): Promise<void> {
    this.disk.files.delete(url);
    this.disk.hashes.delete(url);
    this.disk.checked.delete(url);
    return Promise.resolve();
  }

  isChecked(url: string, sha256: string): Promise<boolean> {
    return Promise.resolve(this.disk.checked.get(url) === sha256);
  }

  markChecked(url: string, sha256: string): Promise<void> {
    this.disk.checked.set(url, sha256);
    return Promise.resolve();
  }

  async load(url: string): Promise<void> {
    this.loads.push(url);
    await this.holdLoad;
    if (this.failLoadWith) throw this.failLoadWith;
  }

  chat(request: WllamaChatRequest): Promise<AsyncIterable<string>> {
    this.requests.push(request);
    return Promise.resolve(items(this.pieces));
  }

  threads(): number {
    return 4;
  }

  exit(): Promise<void> {
    this.exited += 1;
    return Promise.resolve();
  }
}

export function setup(disk = newDisk(), tune: (engine: FakeEngine) => void = () => {}) {
  const engines: FakeEngine[] = [];
  const runtime = new WllamaRuntime(() => {
    const engine = new FakeEngine(disk);
    tune(engine);
    engines.push(engine);
    return engine;
  });
  return { runtime, engines, disk };
}

export const noProgress = (): void => {};

export async function engineAppears(engines: FakeEngine[]): Promise<FakeEngine> {
  for (let i = 0; i < 50 && engines.length === 0; i++) await new Promise((r) => setTimeout(r, 1));
  return engines[0] as FakeEngine;
}
