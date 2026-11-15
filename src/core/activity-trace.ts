// SPDX-License-Identifier: Apache-2.0
// Builds the activity-log entry of one question from what the loop did: model calls, tool calls
// and how it ended. Pure: the clock and the id are passed in, nothing is stored here.
//
// HOOK FOR A BUILT-IN TOOL. A call that goes through the loop shows `tool-call` and `tool-result`
// events and is recorded from them (activity-wrap.ts). A built-in tool of WebAIAssist that runs
// somewhere else (such as `webaiassist_query_graph`) calls `builtinCall` once it has finished.
// The names in BUILTIN_TOOLS are marked "built-in" in the log.
import { CONTENT_LIMIT } from './activity-cap';
import { redactArgs } from './export';
import { contextUse, utf8Length } from './activity-context';
import type {
  ContextUse,
  Decision,
  ModelCall,
  Outcome,
  PlaceKind,
  QuestionRecord,
  ToolCall,
} from './ports/activity-log';
import type { ModelUsage } from './ports/model-runtime';
import type { ChatMessage, ToolArgs } from './types';

/** Tools that WebAIAssist provides itself. The query flow's tool is listed ahead of its arrival. */
export const BUILTIN_TOOLS: readonly string[] = ['webaiassist_query_graph'];

const ERROR_LIMIT = 300;
const MIN_SECRET_LENGTH = 8;
const LOCAL_PLACES: readonly PlaceKind[] = ['gpu', 'cpu', 'chrome', 'own-server', 'by-hand'];

export interface TraceMeta {
  readonly origin: string;
  readonly model: string;
  readonly place: PlaceKind;
  readonly host?: string;
  readonly windowTokens: number;
  /** The user's question; kept only with `includeContent`. */
  readonly text: string;
  readonly includeContent: boolean;
  /** Values that must not appear in the entry, such as the endpoint API key. */
  readonly secrets?: readonly string[];
}

export interface TraceClock {
  /** Milliseconds from a steady clock. */
  nowMs(): number;
  nowIso(): string;
}

export interface QuestionEnd {
  readonly status: 'answered' | 'stopped' | 'step-cap' | 'failed';
  readonly steps: number;
  readonly error?: string;
}

const OUTCOMES: Record<QuestionEnd['status'], Outcome> = {
  answered: 'answered',
  stopped: 'stopped',
  'step-cap': 'step-limit',
  failed: 'error',
};

export interface CallTrace {
  /** One streamed token arrived. */
  token(): void;
  usage(usage: ModelUsage): void;
  end(reply: string): void;
  fail(): void;
}

interface PendingTool {
  name: string;
  args: ToolArgs;
  asked: boolean;
  decision: Decision;
  startedMs?: number;
}

export class QuestionTrace {
  private readonly startedMs: number;
  private readonly calls: ModelCall[] = [];
  private readonly tools: ToolCall[] = [];
  private pending: PendingTool | undefined;

  constructor(
    private readonly meta: TraceMeta,
    private readonly clock: TraceClock,
    private readonly newId: () => string,
  ) {
    this.startedMs = clock.nowMs();
  }

  /** Model calls made so far. */
  get modelCalls(): number {
    return this.calls.length;
  }

  beginCall(messages: readonly ChatMessage[]): CallTrace {
    const began = this.clock.nowMs();
    let firstTokenMs: number | undefined;
    let usage: ModelUsage = {};
    const finish = (reply: string): void => {
      this.calls.push(this.modelCall({ messages, reply, usage, firstTokenMs, began }));
    };
    return {
      token: () => {
        firstTokenMs ??= this.clock.nowMs() - began;
      },
      usage: (reported) => {
        usage = reported;
      },
      end: finish,
      fail: () => finish(''),
    };
  }

  private modelCall(done: {
    messages: readonly ChatMessage[];
    reply: string;
    usage: ModelUsage;
    firstTokenMs: number | undefined;
    began: number;
  }): ModelCall {
    const { messages, reply, usage, firstTokenMs, began } = done;
    const context = contextUse(messages, reply);
    const estimatedPrompt = context.instructions + context.tools + context.site + context.chat;
    const estimated = usage.promptTokens === undefined || usage.completionTokens === undefined;
    return {
      promptTokens: usage.promptTokens ?? estimatedPrompt,
      completionTokens: usage.completionTokens ?? context.reply,
      estimated,
      ...(usage.costUsd === undefined ? {} : { costUsd: usage.costUsd }),
      ...(firstTokenMs === undefined ? {} : { firstTokenMs }),
      totalMs: this.clock.nowMs() - began,
      context,
    };
  }

  /** The confirmation question for a call was shown. */
  toolAsked(name: string, args: ToolArgs): void {
    this.pending = { name, args, asked: true, decision: 'denied' };
  }

  toolAnswered(allowed: boolean): void {
    if (this.pending) this.pending.decision = allowed ? 'allowed' : 'denied';
  }

  /** The call began (after any question). */
  toolStarted(name: string, args: ToolArgs): void {
    const asked = this.pending?.name === name ? this.pending : undefined;
    this.pending = {
      name,
      args,
      asked: asked?.asked ?? false,
      decision: asked?.decision ?? 'not-asked',
      startedMs: this.clock.nowMs(),
    };
  }

  toolFinished(name: string, ok: boolean, text: string): void {
    const call = this.pending;
    this.pending = undefined;
    if (!call || call.name !== name) return;
    const duration = this.clock.nowMs() - (call.startedMs ?? this.clock.nowMs());
    this.tools.push(this.toolEntry(call, { durationMs: duration, ok, text }));
  }

  /** The user said no, or the loop refused a tool the user had already denied. */
  toolDenied(name: string): void {
    const asked = this.pending?.name === name ? this.pending : undefined;
    this.pending = undefined;
    const call: PendingTool = {
      name,
      args: asked?.args ?? {},
      asked: asked?.asked ?? false,
      decision: 'denied',
    };
    this.tools.push(this.toolEntry(call, undefined));
  }

  /** A built-in tool that ran outside the loop's events (see the note at the top). */
  builtinCall(info: {
    name: string;
    args: ToolArgs;
    durationMs: number;
    text: string;
    ok: boolean;
  }): void {
    const call: PendingTool = {
      name: info.name,
      args: info.args,
      asked: false,
      decision: 'not-asked',
    };
    this.tools.push(this.toolEntry(call, info, true));
  }

  private toolEntry(
    call: PendingTool,
    done: { durationMs: number; ok: boolean; text: string } | undefined,
    builtin = BUILTIN_TOOLS.includes(call.name),
  ): ToolCall {
    const content = this.meta.includeContent;
    const argNames = Object.keys(call.args);
    const argBytes = utf8Length(JSON.stringify(call.args));
    return {
      name: this.clean(call.name),
      builtin: builtin || BUILTIN_TOOLS.includes(call.name),
      at: this.clock.nowIso(),
      asked: call.asked,
      decision: call.decision,
      argNames: argNames.map((name) => this.clean(name)),
      argBytes,
      ...(done
        ? {
            durationMs: done.durationMs,
            resultBytes: utf8Length(done.text),
            ok: done.ok,
            ...(done.ok ? {} : { error: this.clean(done.text, ERROR_LIMIT) }),
          }
        : {}),
      ...(content && argBytes <= CONTENT_LIMIT
        ? { args: this.cleanValue(redactArgs(call.args)) }
        : {}),
      ...(content && done ? { result: this.clean(done.text, CONTENT_LIMIT) } : {}),
    };
  }

  build(end: QuestionEnd): QuestionRecord {
    const at = this.clock.nowIso();
    const content = this.meta.includeContent;
    const sum = (pick: (call: ModelCall) => number): number =>
      this.calls.reduce((total, call) => total + pick(call), 0);
    const record = {
      id: this.newId(),
      at,
      day: at.slice(0, 10),
      origin: this.clean(this.meta.origin),
      model: this.clean(this.meta.model),
      place: this.meta.place,
      ...(this.meta.host === undefined ? {} : { host: this.clean(this.meta.host) }),
      windowTokens: this.meta.windowTokens,
      steps: end.steps,
      ...(this.calls[0]?.firstTokenMs === undefined
        ? {}
        : { firstTokenMs: this.calls[0].firstTokenMs }),
      totalMs: this.clock.nowMs() - this.startedMs,
      outcome: OUTCOMES[end.status],
      ...(end.error === undefined ? {} : { error: this.clean(end.error, ERROR_LIMIT) }),
      promptTokens: sum((c) => c.promptTokens),
      completionTokens: sum((c) => c.completionTokens),
      tokensEstimated: this.calls.some((c) => c.estimated),
      cost: this.cost(),
      context: this.largest(),
      calls: this.calls,
      tools: this.tools,
      includeContent: content,
      ...(content ? { text: this.clean(this.meta.text, CONTENT_LIMIT) } : {}),
    };
    return { ...record, bytes: utf8Length(JSON.stringify(record)) };
  }

  private cost(): QuestionRecord['cost'] {
    if (LOCAL_PLACES.includes(this.meta.place)) return { kind: 'none' };
    const priced = this.calls.filter((c) => c.costUsd !== undefined);
    if (priced.length === 0) return { kind: 'unknown' };
    return { kind: 'reported', usd: priced.reduce((sum, c) => sum + (c.costUsd ?? 0), 0) };
  }

  private largest(): ContextUse {
    const total = (c: ContextUse): number => c.instructions + c.tools + c.site + c.chat + c.reply;
    const best = this.calls.reduce<ModelCall | undefined>(
      (top, call) => (top && total(top.context) >= total(call.context) ? top : call),
      undefined,
    );
    return best?.context ?? { instructions: 0, tools: 0, site: 0, chat: 0, reply: 0 };
  }

  /** The text with every known secret removed, cut to `limit` characters. */
  private clean(text: string, limit = Infinity): string {
    let out = text;
    for (const secret of this.meta.secrets ?? []) {
      if (secret.length >= MIN_SECRET_LENGTH) out = out.split(secret).join('[removed]');
    }
    return out.slice(0, limit);
  }

  private cleanValue(value: unknown): unknown {
    return JSON.parse(this.clean(JSON.stringify(value ?? null))) as unknown;
  }
}
