// SPDX-License-Identifier: Apache-2.0
// ModelRuntime adapter on llama.cpp in WebAssembly (@wllama/wllama): the CPU and memory
// model. It runs in the offscreen document (src/entries/shared/model-hosting.ts). The engine
// comes from a factory (src/entries/shared/wllama-factory.ts), so the tests use a fake and
// never load a real one.
//
// The weights are data. They download from the fixed address in src/adapters/cpu-models.ts,
// and every file is checked against the recorded size and SHA-256 before it is used: a file
// that differs is deleted and never loaded. A stored copy that was checked once starts
// without a download and without a new hash. Cancel stops the download at once and deletes
// what was written.
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
} from '../core/ports/model-runtime';
import type { CancelSignal, JsonSchema } from '../core/types';
import {
  asAbortSignal,
  collectStream,
  toRuntimeMessages,
  type RuntimeMessage,
} from './chat-messages';
import { CPU_CAPABILITIES, findCpuModel, type CpuModel } from './cpu-models';
import {
  cpuLoadError,
  downloadStopped,
  isOutOfSpace,
  mismatch,
  noSpace,
  progressText,
} from './wllama-texts';

export interface WllamaChatRequest {
  readonly messages: RuntimeMessage[];
  readonly jsonSchema?: JsonSchema;
  readonly signal?: AbortSignal;
  /** Ask the model not to write its reasoning first (Qwen3's "enable_thinking" switch). */
  readonly thinkingSwitch: boolean;
}

/** The part of the llama.cpp engine this adapter uses. One engine holds one model. */
export interface WllamaEngineLike {
  /** Bytes of the stored copy of `url`, -1 when there is none. */
  storedBytes(url: string): Promise<number>;
  /** Downloads `url` into the browser's storage; `signal` ends the download at once. */
  download(
    url: string,
    onProgress: (loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  /** SHA-256, lower-case hex, of the stored copy. */
  sha256(url: string): Promise<string>;
  /** Deletes the stored copy (and anything half written). */
  remove(url: string): Promise<void>;
  /** True when the stored copy of `url` was checked against `sha256` before. */
  isChecked(url: string, sha256: string): Promise<boolean>;
  markChecked(url: string, sha256: string): Promise<void>;
  /** Loads the stored copy into memory. It never reaches the network. */
  load(url: string, contextTokens: number): Promise<void>;
  chat(request: WllamaChatRequest): Promise<AsyncIterable<string>>;
  /** Threads the model runs with (1 when the page cannot share memory between threads). */
  threads(): number;
  /** Ends the engine and gives its memory back. */
  exit(): Promise<void>;
}

export type WllamaFactory = () => WllamaEngineLike;

const CANCELLED = 'The download was cancelled.';
const DOWNLOAD_SHARE = 0.9;

interface Loaded {
  readonly engine: WllamaEngineLike;
  readonly model: CpuModel;
}

const ended = new WeakSet<WllamaEngineLike>();

/** Ends an engine once, however many paths (cancel, failure, unload) reach for it. */
async function release(engine: WllamaEngineLike): Promise<void> {
  if (ended.has(engine)) return;
  ended.add(engine);
  await engine.exit();
}

/** Throws the cancel error when the user pressed Cancel. */
function checkCancel(signal: AbortSignal): void {
  if (signal.aborted) throw new Error(CANCELLED);
}

export class WllamaRuntime implements ModelRuntime {
  private loaded: Loaded | undefined;
  /** Loads run one after another; a newer load cancels the one still running. */
  private queue: Promise<void> = Promise.resolve();
  private current: AbortController | undefined;

  constructor(
    private readonly factory: WllamaFactory,
    private readonly extraModels: readonly CpuModel[] = [],
  ) {}

  load(
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    cancel?: CancelSignal,
  ): Promise<void> {
    const model = findCpuModel(modelId, this.extraModels);
    if (!model) {
      return Promise.reject(new Error(`"${modelId}" is not one of the models this version ships.`));
    }
    this.current?.abort();
    const abort = new AbortController();
    this.current = abort;
    const signal = asAbortSignal(cancel);
    const forward = (): void => abort.abort();
    if (signal?.aborted) forward();
    else signal?.addEventListener('abort', forward, { once: true });
    const run = this.queue.then(() => this.loadNow(model, onProgress, abort.signal));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run.finally(() => {
      signal?.removeEventListener('abort', forward);
      if (this.current === abort) this.current = undefined;
    });
  }

  private async loadNow(
    model: CpuModel,
    onProgress: (progress: LoadProgress) => void,
    signal: AbortSignal,
  ): Promise<void> {
    checkCancel(signal);
    if (this.loaded?.model.id === model.id) {
      onProgress({ fraction: 1, text: 'Ready' });
      return;
    }
    await this.unload();
    const engine = this.factory();
    try {
      await this.fetchWeights(engine, model, onProgress, signal);
      await this.intoMemory(engine, model, onProgress, signal);
    } catch (error) {
      await release(engine).catch(() => undefined);
      throw error;
    }
    this.loaded = { engine, model };
    onProgress({ fraction: 1, text: 'Ready' });
  }

  /** The weights on disk and checked: from the stored copy, or downloaded and checked now. */
  private async fetchWeights(
    engine: WllamaEngineLike,
    model: CpuModel,
    onProgress: (progress: LoadProgress) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const stored = await engine.storedBytes(model.url);
    if (stored === model.bytes && (await engine.isChecked(model.url, model.sha256))) return;
    if (stored !== model.bytes) {
      if (stored !== -1) await engine.remove(model.url);
      await this.download(engine, model, onProgress, signal);
    }
    checkCancel(signal);
    onProgress({ fraction: DOWNLOAD_SHARE, text: 'Checking the downloaded file (SHA-256)…' });
    await this.check(engine, model);
  }

  private async download(
    engine: WllamaEngineLike,
    model: CpuModel,
    onProgress: (progress: LoadProgress) => void,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await engine.download(
        model.url,
        (loaded, total) => {
          const fraction = Math.min(1, loaded / (total || model.bytes)) * DOWNLOAD_SHARE;
          if (!signal.aborted) onProgress({ fraction, text: progressText(model, loaded, total) });
        },
        signal,
      );
    } catch (error) {
      await engine.remove(model.url).catch(() => undefined);
      if (signal.aborted) throw new Error(CANCELLED);
      throw new Error(isOutOfSpace(error) ? noSpace(model) : downloadStopped(error));
    }
    if ((await engine.storedBytes(model.url)) !== model.bytes) await this.reject(engine, model);
  }

  /** Hashes the stored copy; a copy that differs is deleted and the load ends with an error. */
  private async check(engine: WllamaEngineLike, model: CpuModel): Promise<void> {
    if ((await engine.sha256(model.url)) !== model.sha256) await this.reject(engine, model);
    await engine.markChecked(model.url, model.sha256);
  }

  private async reject(engine: WllamaEngineLike, model: CpuModel): Promise<never> {
    await engine.remove(model.url);
    throw new Error(mismatch(model));
  }

  /** Loads into memory; Cancel answers at once, and the model that finished later is freed. */
  private async intoMemory(
    engine: WllamaEngineLike,
    model: CpuModel,
    onProgress: (progress: LoadProgress) => void,
    signal: AbortSignal,
  ): Promise<void> {
    checkCancel(signal);
    onProgress({ fraction: 0.95, text: `Loading ${model.label.split(' (')[0]} into memory…` });
    const loading = engine
      .load(model.url, CPU_CAPABILITIES.contextTokens)
      .catch((error: unknown) => {
        throw new Error(cpuLoadError(error, model));
      });
    const cancelled = new Promise<never>((_, reject) => {
      const stop = (): void => {
        void loading.then(() => release(engine)).catch(() => undefined);
        reject(new Error(CANCELLED));
      };
      if (signal.aborted) stop();
      else signal.addEventListener('abort', stop, { once: true });
      void loading.finally(() => signal.removeEventListener('abort', stop)).catch(() => undefined);
    });
    await Promise.race([loading, cancelled]);
  }

  async chat(request: ChatRequest): Promise<string> {
    const engine = this.loaded?.engine;
    const model = this.loaded?.model;
    if (!engine || !model) throw new Error('No model is loaded.');
    const signal = asAbortSignal(request.signal);
    let text = '';
    try {
      const pieces = await engine.chat({
        messages: toRuntimeMessages(request.messages),
        ...(request.jsonSchema ? { jsonSchema: request.jsonSchema } : {}),
        ...(signal ? { signal } : {}),
        thinkingSwitch: model.thinkingSwitch,
      });
      return await collectStream(pieces, (piece) => {
        text += piece;
        request.onToken?.(piece);
      }).then(() => text);
    } catch (error) {
      // Stop ends the stream with an abort error; what was written so far is the reply.
      if (signal?.aborted) return text;
      throw error;
    }
  }

  async unload(): Promise<void> {
    const loaded = this.loaded;
    this.loaded = undefined;
    if (loaded) await release(loaded.engine);
  }

  capabilities(): ModelCapabilities {
    return CPU_CAPABILITIES;
  }

  where(): string | undefined {
    return this.loaded ? `cpu:${this.loaded.engine.threads()}` : undefined;
  }
}
