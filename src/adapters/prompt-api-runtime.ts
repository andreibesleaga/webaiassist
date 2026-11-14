// SPDX-License-Identifier: Apache-2.0
// ModelRuntime adapter on Chrome's Prompt API (`LanguageModel`, Gemini Nano). It runs in the
// side panel page: the Prompt API exists on extension pages and the extension service worker,
// not in Web Workers, and while the model is "downloadable" create() needs the user's click,
// which only the panel has. So load() calls create() first, straight from the Start click,
// with a `monitor` for the download and Cancel's signal; it polls availability() while it
// waits and says what Chrome reports (percent, "preparing", no progress, unavailable).
// Tool use goes through the prompted-JSON route (nativeToolCalls: false), with the reply
// constrained to the action schema (`responseConstraint`), so every reply is a valid action;
// the core still checks the arguments of a call against the tool's own schema. The window is
// read from the first session (`contextWindow`, older Chrome: `inputQuota`) and the core sends
// the compact tool list, because the window is small (about 9k tokens, shared with the reply).
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
import { measureInput, shrinkTurns } from './prompt-api-fit';
import {
  ABSENT,
  explainChatFailure,
  explainFailure,
  isQuotaError,
  LANGUAGE_OPTIONS,
  quotaNumbers,
  readState,
} from './prompt-api-state';
import { LoadWatch } from './prompt-api-watch';

export interface PromptOptions {
  signal?: AbortSignal;
  responseConstraint?: object;
  omitResponseConstraintInput?: boolean;
}

export interface PromptSession {
  /** Tokens the session can hold (older Chrome: `inputQuota`). */
  readonly contextWindow?: number;
  readonly inputQuota?: number;
  /** Tokens held now (older Chrome: `inputUsage`). */
  readonly contextUsage?: number;
  readonly inputUsage?: number;
  measureContextUsage?(input: string, options?: object): Promise<number>;
  measureInputUsage?(input: string, options?: object): Promise<number>;
  promptStreaming(input: string, options?: PromptOptions): AsyncIterable<string>;
  destroy(): void;
}

/** The part of the `LanguageModel` global this adapter uses. */
export interface LanguageModelStatic {
  availability(options?: object): Promise<string>;
  create(options?: Record<string, unknown>): Promise<PromptSession>;
}

export interface PromptApiTiming {
  /** How often availability() is read while create() waits (ms). */
  readonly pollMs?: number;
  /** No download event for this long shows the "no progress" line (ms). */
  readonly stallMs?: number;
  readonly now?: () => number;
  readonly every?: (ms: number, fn: () => void) => () => void;
}

export const CANCELLED = 'The download was cancelled.';
const NOT_LOADED = "Chrome's built-in model is not loaded.";
/** The window assumed until Chrome reports one. */
const DEFAULT_WINDOW = 4096;
/** Tokens kept free for the reply, at most a quarter of the window. */
const MAX_REPLY_TOKENS = 1024;

const realEvery = (ms: number, fn: () => void): (() => void) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

type Timing = Required<PromptApiTiming>;

/** One question to the model: the earlier turns, the last user turn, how to ask. */
interface Job {
  readonly turns: readonly RuntimeMessage[];
  readonly last: string;
  readonly request: ChatRequest;
  /** Set once a piece of the reply was handed on: a retry would repeat it. */
  emitted: boolean;
}

interface Running {
  readonly session: PromptSession;
}

const windowOf = (session: PromptSession): number | undefined => {
  const size = session.contextWindow ?? session.inputQuota;
  return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : undefined;
};

/** A schema Chrome cannot use is a SyntaxError or, on some builds, a NotSupportedError. */
const refusesConstraint = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'SyntaxError' ||
    (error.name === 'NotSupportedError' && !/language/i.test(error.message)));

export class PromptApiRuntime implements ModelRuntime {
  private ready = false;
  private windowTokens: number | undefined;
  private constraintRefused = false;
  /** Aborted by unload(): ends a load that waits and every session that answers. */
  private life = new AbortController();
  private readonly running = new Set<Running>();
  private readonly timing: Timing;

  constructor(
    private readonly lm: LanguageModelStatic | undefined,
    timing: PromptApiTiming = {},
  ) {
    this.timing = { pollMs: 2000, stallMs: 120_000, now: Date.now, every: realEvery, ...timing };
  }

  async load(
    _id: string,
    onProgress: (p: LoadProgress) => void,
    cancel?: CancelSignal,
  ): Promise<void> {
    const lm = this.lm;
    if (!lm) throw new Error(ABSENT);
    this.life = new AbortController();
    const outside = asAbortSignal(cancel);
    const signal = AbortSignal.any(outside ? [this.life.signal, outside] : [this.life.signal]);
    const watch = new LoadWatch(onProgress, this.timing.now, this.timing.stallMs);
    // First call of the click: Chrome needs the user's activation while it must download.
    const creating = lm.create({ ...LANGUAGE_OPTIONS, monitor: watch.monitor, signal });
    const stopPolling = this.timing.every(this.timing.pollMs, () => void watch.poll(lm));
    try {
      const session = await creating;
      this.windowTokens = windowOf(session);
      session.destroy();
    } catch (error) {
      if (signal.aborted) throw new Error(CANCELLED);
      throw explainFailure(error, await readState(lm));
    } finally {
      stopPolling();
    }
    this.ready = true;
  }

  async chat(request: ChatRequest): Promise<string> {
    if (!this.ready || !this.lm) throw new Error(NOT_LOADED);
    const turns = toRuntimeMessages(request.messages);
    const last = turns.pop();
    if (last?.role !== 'user') throw new Error('The last message must be a user turn.');
    const job: Job = { turns, last: last.content, request, emitted: false };
    try {
      return await this.answer(job);
    } catch (error) {
      const smaller = this.smaller(job, error);
      if (!smaller) throw explainChatFailure(error);
      return this.answer({ ...job, turns: smaller }).catch((again: unknown) => {
        throw explainChatFailure(again);
      });
    }
  }

  /** The earlier turns cut for a second try, when Chrome said the input was too long. */
  private smaller(job: Job, error: unknown): RuntimeMessage[] | undefined {
    if (!isQuotaError(error) || job.emitted) return undefined;
    const { requested, contextWindow } = quotaNumbers(error);
    const room = (contextWindow ?? this.window()) - this.replyTokens();
    return shrinkTurns(job.turns, room, requested ?? room * 2);
  }

  /** One try, with the reply constrained to the schema; without the constraint when Chrome
   *  refuses the schema before the first piece of the reply. */
  private async answer(job: Job): Promise<string> {
    const schema = job.request.jsonSchema;
    if (schema === undefined || this.constraintRefused) return this.attempt(job, undefined);
    try {
      return await this.attempt(job, schema);
    } catch (error) {
      if (job.emitted || !refusesConstraint(error)) throw error;
      this.constraintRefused = true;
      return this.attempt(job, undefined);
    }
  }

  private async attempt(job: Job, schema: object | undefined): Promise<string> {
    const lm = this.lm as LanguageModelStatic;
    const outside = asAbortSignal(job.request.signal);
    const signal = AbortSignal.any(outside ? [this.life.signal, outside] : [this.life.signal]);
    const session = await lm.create({
      ...LANGUAGE_OPTIONS,
      initialPrompts: job.turns,
      signal,
    });
    const running: Running = { session };
    this.running.add(running);
    try {
      await this.checkFit(session, job.last);
      const options: PromptOptions = {
        signal,
        ...(schema ? { responseConstraint: schema, omitResponseConstraintInput: true } : {}),
      };
      const onToken = (piece: string): void => {
        job.emitted = true;
        job.request.onToken?.(piece);
      };
      return await collectStream(session.promptStreaming(job.last, options), onToken);
    } finally {
      this.running.delete(running);
      session.destroy();
    }
  }

  /** With Chrome's measure: the earlier turns plus the question plus the reply room must fit.
   *  Without it Chrome's own QuotaExceededError says so. */
  private async checkFit(session: PromptSession, last: string): Promise<void> {
    const measured = await measureInput(session, last);
    if (measured === undefined) return;
    const contextWindow = windowOf(session) ?? this.window();
    if (measured <= contextWindow - this.replyTokens()) return;
    throw Object.assign(new Error('The input is over the context window.'), {
      name: 'QuotaExceededError',
      requested: measured,
      contextWindow,
    });
  }

  async unload(): Promise<void> {
    this.ready = false;
    this.life.abort();
    for (const { session } of this.running) session.destroy();
    this.running.clear();
    await Promise.resolve();
  }

  private window(): number {
    return this.windowTokens ?? DEFAULT_WINDOW;
  }

  private replyTokens(): number {
    return Math.min(MAX_REPLY_TOKENS, Math.floor(this.window() / 4));
  }

  capabilities(): ModelCapabilities {
    return {
      nativeToolCalls: false,
      jsonConstraint: !this.constraintRefused,
      contextTokens: this.window(),
      compactPrompt: true,
      replyTokens: this.replyTokens(),
    };
  }
}
