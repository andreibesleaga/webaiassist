// SPDX-License-Identifier: Apache-2.0
// ModelRuntime adapter on llama.cpp in WebAssembly (@wllama/wllama): the models in the browser,
// on the processor and memory or with every layer on the graphics card (WebGPU). One instance
// serves one of the two. It runs in the offscreen document (src/entries/shared/model-hosting.ts).
// The engine comes from a factory (src/entries/shared/wllama-engine.ts), so the tests use a fake
// and never load a real one.
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
import { CPU_CAPABILITIES, findCpuModel, findGpuModel, type CpuModel } from './cpu-models';
import { MODEL_STOPPED } from './model-errors';
import { cpuLoadError } from './wllama-texts';
import { CANCELLED, checkCancel, fetchWeights } from './wllama-weights';

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
  /** SHA-256 of each consecutive piece of `partBytes` of the stored copy, for a file too large
   *  for one call (CpuModel.parts). */
  sha256Parts(url: string, partBytes: number): Promise<string[]>;
  /** Deletes the stored copy (and anything half written). */
  remove(url: string): Promise<void>;
  /** True when the stored copy of `url` was checked against `sha256` before. */
  isChecked(url: string, sha256: string): Promise<boolean>;
  markChecked(url: string, sha256: string): Promise<void>;
  /** Loads the stored copy into memory, or onto the graphics card. It never reaches the network. */
  load(url: string, contextTokens: number, device: Device): Promise<void>;
  chat(request: WllamaChatRequest): Promise<AsyncIterable<string>>;
  /** Threads the model runs with (1 when the page cannot share memory between threads). */
  threads(): number;
  /** Ends the engine and gives its memory back. */
  exit(): Promise<void>;
}

export type WllamaFactory = () => WllamaEngineLike;

/** Where one runtime instance runs its models. */
export type Device = 'cpu' | 'gpu';

/** What the host is told where a graphics-card model runs: the engine's own Worker in the
 *  offscreen document. */
export const GPU_PLACE = 'offscreen-worker';

/** How long a reply may run on after Stop before the engine is ended. The stop is read between two
 *  pieces of work; a model too slow for the graphics card can stay inside one piece for minutes
 *  and keep the browser's GPU busy (runs of 15 and 16 Nov 2026). */
export const STOP_GRACE_MS = 5_000;

/** The engine's words when it has ended by itself: llama.cpp aborted (out of memory, or the
 *  graphics device went away), after which every call says it has crashed. */
const ENGINE_GONE = /\(ABORT\)|has crashed|Aborted\(/i;

/** What the user is told when a graphics-card model's engine ended. The words "device was lost"
 *  make the host start again with a fresh graphics device (src/adapters/model-errors.ts). */
export const GPU_GAVE_UP =
  'The model stopped: the graphics card gave up (the device was lost). Press Start to load it again, or choose a smaller model or one on the processor.';

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

export class WllamaRuntime implements ModelRuntime {
  private loaded: Loaded | undefined;
  /** Loads run one after another; a newer load cancels the one still running. */
  private queue: Promise<void> = Promise.resolve();
  private current: AbortController | undefined;

  constructor(
    private readonly factory: WllamaFactory,
    private readonly extraModels: readonly CpuModel[] = [],
    private readonly device: Device = 'cpu',
  ) {}

  private find(modelId: string): CpuModel | undefined {
    const find = this.device === 'gpu' ? findGpuModel : findCpuModel;
    return find(modelId, this.extraModels);
  }

  load(
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    cancel?: CancelSignal,
  ): Promise<void> {
    const model = this.find(modelId);
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
      await fetchWeights(engine, model, onProgress, signal);
      await this.intoMemory(engine, model, onProgress, signal);
    } catch (error) {
      await release(engine).catch(() => undefined);
      throw error;
    }
    this.loaded = { engine, model };
    onProgress({ fraction: 1, text: 'Ready' });
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
      .load(model.url, CPU_CAPABILITIES.contextTokens, this.device)
      .catch((error: unknown) => {
        // A graphics device lost during the load: the same words as in a chat, so the host
        // starts again with a fresh device (model-errors.ts).
        if (this.device === 'gpu' && ENGINE_GONE.test(String(error))) throw new Error(GPU_GAVE_UP);
        throw new Error(cpuLoadError(error, model, this.device));
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
    const loaded = this.loaded;
    if (!loaded) throw new Error('No model is loaded.');
    const signal = asAbortSignal(request.signal);
    let text = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    let giveUp: (error: Error) => void = () => undefined;
    const stuck = new Promise<never>((_, reject) => (giveUp = reject));
    // Stop ends the stream at once when the engine reads it; one that does not is ended.
    const stop = (): void => {
      timer ??= setTimeout(() => {
        this.letGo(loaded);
        giveUp(new Error(MODEL_STOPPED));
      }, STOP_GRACE_MS);
    };
    signal?.addEventListener('abort', stop, { once: true });
    const reply = this.reply(loaded, request, signal, (piece) => {
      text += piece;
      request.onToken?.(piece);
    });
    reply.catch(() => undefined); // when `stuck` wins, the reply's own end is of no interest
    try {
      await Promise.race([reply, stuck]);
      return text;
    } catch (error) {
      if (error instanceof Error && error.message === MODEL_STOPPED) throw error;
      // Stop ends the stream with an abort error; what was written so far is the reply.
      if (signal?.aborted) return text;
      throw this.afterFailure(loaded, error);
    } finally {
      signal?.removeEventListener('abort', stop);
      clearTimeout(timer);
    }
  }

  private async reply(
    loaded: Loaded,
    request: ChatRequest,
    signal: AbortSignal | undefined,
    onPiece: (piece: string) => void,
  ): Promise<void> {
    const pieces = await loaded.engine.chat({
      messages: toRuntimeMessages(request.messages),
      ...(request.jsonSchema ? { jsonSchema: request.jsonSchema } : {}),
      ...(signal ? { signal } : {}),
      thinkingSwitch: loaded.model.thinkingSwitch,
    });
    await collectStream(pieces, onPiece);
  }

  /** Lets go of an engine that is of no more use: the next load really loads again (it would
   *  otherwise answer "Ready" at once). Ending it stops its Worker. */
  private letGo(loaded: Loaded): void {
    if (this.loaded === loaded) this.loaded = undefined;
    void release(loaded.engine).catch(() => undefined);
  }

  /** An engine that ended by itself is let go. On the graphics card the cause is the device, and
   *  the message says so in the words the host restarts on. */
  private afterFailure(loaded: Loaded, error: unknown): unknown {
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    if (!ENGINE_GONE.test(text)) return error;
    this.letGo(loaded);
    return new Error(this.device === 'gpu' ? GPU_GAVE_UP : MODEL_STOPPED);
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
    if (!this.loaded) return undefined;
    return this.device === 'gpu' ? GPU_PLACE : `cpu:${this.loaded.engine.threads()}`;
  }
}
