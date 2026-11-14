// SPDX-License-Identifier: Apache-2.0
import type { LanguageModelStatic, PromptSession } from '../../src/adapters/prompt-api-runtime';
import { items } from './runtime-helpers';

export class FakeSession implements PromptSession {
  destroyed = false;
  contextWindow: number | undefined;
  inputQuota: number | undefined;
  readonly prompts: { input: string; options?: object }[] = [];
  failPrompt: Error | undefined;
  constructor(private readonly pieces: string[]) {}
  promptStreaming(input: string, options?: object): AsyncIterable<string> {
    this.prompts.push({ input, ...(options ? { options } : {}) });
    if (this.failPrompt) return failing(this.failPrompt);
    return items(this.pieces);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

function failing(error: Error): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(error) }),
  };
}

type Listener = (e: { loaded: number }) => void;
type Monitor = { addEventListener(type: string, cb: Listener): void };

/** A fake `LanguageModel`. `hold` keeps create() pending until the test settles it. */
export class FakeLanguageModel implements LanguageModelStatic {
  readonly calls: string[] = [];
  readonly creates: Record<string, unknown>[] = [];
  readonly sessions: FakeSession[] = [];
  progress: Listener | undefined;
  hold = false;
  failWith: Error | undefined;
  /** Errors for the next create() calls, one per call, before any session is made. */
  failCreates: Error[] = [];
  contextWindow: number | undefined = 9216;
  inputQuota: number | undefined;
  failPrompt: Error | undefined;
  settle: { resolve: (s: PromptSession) => void; reject: (e: unknown) => void } | undefined;
  constructor(
    public state: string,
    private readonly pieces: string[] = [],
  ) {}
  availability(options?: object): Promise<string> {
    this.calls.push(`availability ${JSON.stringify(options ?? {})}`);
    return Promise.resolve(this.state);
  }
  create(options: Record<string, unknown> = {}): Promise<PromptSession> {
    this.calls.push('create');
    this.creates.push(options);
    const monitor = options.monitor as ((m: Monitor) => void) | undefined;
    monitor?.({ addEventListener: (_type, cb) => (this.progress = cb) });
    const nextFailure = this.failCreates.shift();
    if (nextFailure) return Promise.reject(nextFailure);
    const session = new FakeSession(this.pieces);
    session.contextWindow = this.contextWindow;
    session.inputQuota = this.inputQuota;
    session.failPrompt = this.failPrompt;
    this.sessions.push(session);
    if (this.failWith) return Promise.reject(this.failWith);
    if (!this.hold) return Promise.resolve(session);
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
      const signal = options.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  }
}

/** Manual timers: `fire()` runs the polled check once; `at` is the clock in ms. */
export function clock() {
  const state = { at: 0, tick: undefined as (() => void) | undefined, stopped: 0 };
  return {
    state,
    options: {
      now: () => state.at,
      every: (_ms: number, fn: () => void) => {
        state.tick = fn;
        return () => (state.stopped += 1);
      },
    },
    fire: async () => {
      state.tick?.();
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    },
  };
}

export const ID = 'chrome-built-in';
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
export const LANGS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
