// SPDX-License-Identifier: Apache-2.0
// ModelRuntime adapter on WebLLM (@mlc-ai/web-llm). It loads only the four shipped models,
// whose libraries are inside the package (no remote code). The engine is created by a factory
// that the host passes in (src/entries/shared/webllm-factory.ts), so tests use a fake
// and never load a real engine. Replies use prompted JSON without a grammar: WebLLM 0.2.86
// failed "GrammarMatcherInitError ... Cannot pass non-string to std::string" on the owner's
// machine, and the core's action parser and argument validator check the JSON anyway.
// Native tool calls exist only for the Hermes models, which are not shipped.
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
} from '../core/ports/model-runtime';
import type { CancelSignal } from '../core/types';
import {
  asAbortSignal,
  collectStream,
  toRuntimeMessages,
  type RuntimeMessage,
} from './chat-messages';
import { DEVICE_LOST, MODEL_STOPPED, NOT_LOADED } from './model-errors';
import { WEBLLM_MODEL_IDS } from './models';

export interface WebLlmRequest {
  readonly messages: RuntimeMessage[];
  readonly stream: true;
  readonly temperature: number;
  readonly extra_body?: { readonly enable_thinking: boolean };
}

export interface WebLlmChunk {
  readonly choices: readonly { readonly delta: { readonly content?: string | null } }[];
}

/** The part of WebLLM's MLCEngine this adapter uses. */
export interface WebLlmEngineLike {
  readonly chat: {
    readonly completions: {
      create(request: WebLlmRequest): Promise<AsyncIterable<WebLlmChunk>>;
    };
  };
  interruptGenerate(): void;
  unload(): Promise<void>;
  /** Ends the engine at once, without waiting for it (in a Worker: terminate). */
  kill?(): void;
  /** Where the factory put the engine (offscreen-worker, offscreen-main, service-worker). */
  readonly where?: string;
}

/** Creates an engine with the model loaded; `signal` stops the download (the engine then
 *  resolves without the model, and the runtime treats that as cancelled). */
export type WebLlmFactory = (
  modelId: string,
  onProgress: (report: { progress: number; text: string }) => void,
  signal?: AbortSignal,
) => Promise<WebLlmEngineLike>;

const TEMPERATURE = 0.2;

async function* deltas(chunks: AsyncIterable<WebLlmChunk>): AsyncIterable<string> {
  for await (const chunk of chunks) yield chunk.choices[0]?.delta.content ?? '';
}

const CANCELLED = 'The download was cancelled.';

/** Settles when the signal is aborted (at once when it already is). */
const cancelled = (signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });

/** How long a reply may run on after Stop before the engine is ended. WebLLM's interrupt is read
 *  between two pieces of GPU work; a model too slow for the graphics card can stay inside one
 *  piece for minutes and keep the browser's GPU busy (runs of 15 and 16 Nov 2026). */
export const STOP_GRACE_MS = 5_000;

export class WebLlmRuntime implements ModelRuntime {
  private engine: WebLlmEngineLike | undefined;
  private modelId = '';
  /** Loads run one after another; `current` is the newest one's cancel (the older is cancelled). */
  private queue: Promise<void> = Promise.resolve();
  private current: AbortController | undefined;
  /** The unload of an engine that was ended and could not be killed; the next load waits for it. */
  private ending: Promise<void> = Promise.resolve();

  constructor(private readonly factory: WebLlmFactory) {}

  /** One engine, one load at a time. A load still running (Cancel pressed, or Start pressed
   *  again) is cancelled and waited for first, so two engines never share the GPU. The model
   *  already loaded stays: a reopened panel pressing Start gets it at once. */
  load(
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    cancel?: CancelSignal,
  ): Promise<void> {
    if (!WEBLLM_MODEL_IDS.includes(modelId)) {
      return Promise.reject(new Error(`"${modelId}" is not one of the models this version ships.`));
    }
    this.current?.abort();
    const abort = new AbortController();
    this.current = abort;
    const signal = asAbortSignal(cancel);
    const forward = (): void => abort.abort();
    if (signal?.aborted) forward();
    else signal?.addEventListener('abort', forward, { once: true });
    const run = this.queue.then(() => this.loadNow(modelId, onProgress, abort));
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
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    abort: AbortController,
  ): Promise<void> {
    if (abort.signal.aborted) throw new Error(CANCELLED);
    if (this.engine && this.modelId === modelId) {
      onProgress({ fraction: 1, text: 'Ready' });
      return;
    }
    await this.unload();
    await Promise.race([this.ending, cancelled(abort.signal)]); // Cancel ends the wait too
    if (abort.signal.aborted) throw new Error(CANCELLED);
    const engine = await this.factory(
      modelId,
      (report) => onProgress({ fraction: report.progress, text: report.text }),
      abort.signal,
    );
    if (abort.signal.aborted) {
      await engine.unload();
      throw new Error(CANCELLED);
    }
    this.engine = engine;
    this.modelId = modelId;
  }

  async chat(request: ChatRequest): Promise<string> {
    const engine = this.engine;
    if (!engine) throw new Error('No model is loaded.');
    const signal = asAbortSignal(request.signal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let giveUp: (error: Error) => void = () => undefined;
    const stuck = new Promise<never>((_, reject) => (giveUp = reject));
    const stop = (): void => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        this.end(engine);
        giveUp(new Error(MODEL_STOPPED));
      }, STOP_GRACE_MS);
      try {
        engine.interruptGenerate();
      } catch {
        // An engine that cannot even be interrupted is ended by the timer.
      }
    };
    if (signal?.aborted) stop();
    else signal?.addEventListener('abort', stop, { once: true });
    const reply = this.reply(engine, request);
    reply.catch(() => undefined); // when `stuck` wins, the reply's own end is of no interest
    try {
      return await Promise.race([reply, stuck]);
    } catch (error) {
      throw this.afterFailure(engine, error);
    } finally {
      signal?.removeEventListener('abort', stop);
      clearTimeout(timer);
    }
  }

  private async reply(engine: WebLlmEngineLike, request: ChatRequest): Promise<string> {
    const chunks = await engine.chat.completions.create(this.request(request));
    return collectStream(deltas(chunks), request.onToken);
  }

  /** Lets go of an engine that does not stop: the next load really loads again. An engine in a
   *  Worker is killed at once (its unload would never answer). One on the main thread cannot be
   *  killed: the next load waits for its unload, so two models never share the GPU. */
  private end(engine: WebLlmEngineLike): void {
    if (this.engine === engine) this.engine = undefined;
    const unloaded = engine.unload().catch(() => undefined);
    if (engine.kill) engine.kill();
    else this.ending = unloaded;
  }

  /** An engine that lost its GPU device, or that WebLLM no longer has loaded, is dead: it is let
   *  go, so the next load really loads again (it would otherwise answer "Ready" at once). The
   *  second case also gets the plain message in place of WebLLM's sentence. */
  private afterFailure(engine: WebLlmEngineLike, error: unknown): unknown {
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    const stopped = NOT_LOADED.test(text);
    if (!stopped && !DEVICE_LOST.test(text)) return error;
    if (this.engine === engine) this.engine = undefined;
    void engine.unload().catch(() => undefined);
    return stopped ? new Error(MODEL_STOPPED) : error;
  }

  async unload(): Promise<void> {
    const engine = this.engine;
    this.engine = undefined;
    if (engine) await engine.unload();
  }

  capabilities(): ModelCapabilities {
    return { nativeToolCalls: false, jsonConstraint: false, contextTokens: 4096 };
  }

  where(): string | undefined {
    return this.engine?.where;
  }

  private request(request: ChatRequest): WebLlmRequest {
    return {
      messages: toRuntimeMessages(request.messages),
      stream: true,
      temperature: TEMPERATURE,
      ...(this.modelId.startsWith('Qwen3') ? { extra_body: { enable_thinking: false } } : {}),
    };
  }
}
