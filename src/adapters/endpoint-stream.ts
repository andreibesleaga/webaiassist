// SPDX-License-Identifier: Apache-2.0
// Reading what a chat-completions endpoint sends: the event stream of a reply (capped at 1 MB,
// stopped after 60 seconds without data) and the message of an error body (read up to 2 KB,
// however large the service makes it).
import type { ModelUsage } from '../core/ports/model-runtime';

export const MAX_REPLY_BYTES = 1024 * 1024;
/** A reply, or the wait for its headers, that sends nothing for this long is stopped. */
export const IDLE_MS = 60_000;
const ERROR_BODY_BYTES = 2048;

/** A timer that fires when nothing came for `ms`; `touch` starts it again. */
export class IdleWatch {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners: (() => void)[] = [];
  fired = false;

  constructor(private readonly ms: number) {
    this.touch();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  touch(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.fired = true;
      this.listeners.forEach((listener) => listener());
      this.controller.abort(new Error('idle'));
    }, this.ms);
  }

  onFire(listener: () => void): void {
    this.listeners.push(listener);
  }

  stop(): void {
    clearTimeout(this.timer);
  }
}

/** At most `max` bytes of a body as text; the rest is never read (the stream is cancelled). */
async function cappedText(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.byteLength;
  }
  return new TextDecoder().decode(all.subarray(0, max));
}

export interface StreamEvent {
  readonly content: string;
  readonly usage?: ModelUsage;
  /** The service's own error text, from an error event inside the stream. */
  readonly failure?: string;
}

/** The parsed data: events of a chat-completions event stream (ended by [DONE]). */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
  idle: IdleWatch,
): AsyncIterable<StreamEvent> {
  const reader = body.getReader();
  idle.onFire(() => void reader.cancel().catch(() => undefined));
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    idle.touch();
    bytes += value.byteLength;
    if (bytes > MAX_REPLY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('The endpoint reply is larger than 1 MB; it was stopped.');
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const event = readLine(line.trim());
      if (event === null) return;
      yield event;
    }
  }
}

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/** The counts and the price of a `usage` object; undefined when it holds none of them. */
function readUsage(value: unknown): ModelUsage | undefined {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const promptTokens = count(raw.prompt_tokens);
  const completionTokens = count(raw.completion_tokens);
  const costUsd = count(raw.cost);
  const usage = {
    ...(promptTokens === undefined ? {} : { promptTokens }),
    ...(completionTokens === undefined ? {} : { completionTokens }),
    ...(costUsd === undefined ? {} : { costUsd }),
  };
  return Object.keys(usage).length > 0 ? usage : undefined;
}

const NOTHING: StreamEvent = { content: '' };

type Chunk = {
  choices?: { delta?: { content?: unknown } }[];
  usage?: unknown;
  error?: { message?: unknown };
};

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The event of one parsed chunk: its text, its usage, and its error message when it holds one. */
function eventOf(raw: Chunk): StreamEvent {
  const usage = readUsage(raw.usage);
  const failure = raw.error === undefined ? undefined : textOf(raw.error.message) || 'error';
  return {
    content: textOf(raw.choices?.[0]?.delta?.content),
    ...(usage ? { usage } : {}),
    ...(failure === undefined ? {} : { failure }),
  };
}

/** One line as an event; null at [DONE]; an empty event for anything else. */
function readLine(line: string): StreamEvent | null {
  if (!line.startsWith('data:')) return NOTHING;
  const data = line.slice(5).trim();
  if (data === '[DONE]') return null;
  try {
    return eventOf(JSON.parse(data) as Chunk);
  } catch {
    return NOTHING;
  }
}

/** The message of a JSON error body (`{"error":{"message":…}}`), read from at most 2 KB. */
export async function serviceMessage(response: Response): Promise<string | undefined> {
  try {
    const text = await cappedText(response, ERROR_BODY_BYTES);
    const raw = JSON.parse(text) as { error?: { message?: unknown } | string };
    const message = typeof raw.error === 'string' ? raw.error : raw.error?.message;
    return typeof message === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
}
