// SPDX-License-Identifier: Apache-2.0
// ModelRuntime adapter for an OpenAI-compatible chat-completions endpoint that the user
// sets in Options: Ollama, LM Studio, llama.cpp, vLLM or any service. For computers with
// no usable GPU. The conversation goes only to that address: redirects are refused (one
// could carry the chat to another host, or from https to http). Plain HTTP is accepted only
// on this computer (localhost, 127.0.0.1); anything else must be HTTPS, and an address with
// a user name or password is refused. A reply is capped at 1 MB; connecting times out.
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
  ModelUsage,
} from '../core/ports/model-runtime';
import type { CancelSignal } from '../core/types';
import { asAbortSignal, toRuntimeMessages } from './chat-messages';

export interface EndpointConfig {
  /** Base URL that ends before /chat/completions, for example http://localhost:11434/v1. */
  readonly url: string;
  readonly model: string;
  /** Sent as "Authorization: Bearer <key>" when not empty. */
  readonly apiKey?: string;
  /** The model's context window in tokens (Options); 8192 when not given. */
  readonly contextTokens?: number;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Each has an optional host permission in the manifest (http://localhost/*, http://127.0.0.1/*). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const TEMPERATURE = 0.2;
export const MAX_REPLY_BYTES = 1024 * 1024;
export const LOAD_TIMEOUT_MS = 15_000;
const DEFAULT_CONTEXT_TOKENS = 8192;

/** The address is on this computer (localhost or 127.0.0.1, any port): the chat does not leave it. */
export function isLocalEndpoint(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function endpointUrlProblem(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'This is not a web address.';
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return 'Leave the user name and password out of the address; use the API key field.';
  }
  if (parsed.protocol === 'https:') return undefined;
  if (parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname)) return undefined;
  return 'Use https, or http only for localhost or 127.0.0.1.';
}

const timedOut = (signal: AbortSignal | null | undefined): boolean =>
  signal?.aborted === true &&
  (signal.reason as { name?: unknown } | undefined)?.name === 'TimeoutError';

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface StreamEvent {
  readonly content: string;
  readonly usage?: ModelUsage;
  /** The service's own error text, from an error event inside the stream. */
  readonly failure?: string;
}

/** The parsed data: events of a chat-completions event stream (ended by [DONE]). */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
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

/** Ollama refuses origins it does not list, and lists no extension origin by default. */
const FORBIDDEN_HINT =
  ' Ollama refuses extensions unless it is started with OLLAMA_ORIGINS=chrome-extension://*.';

/** Longest piece of a service's own error text that is shown. */
const SERVICE_TEXT_CHARS = 200;
const MIN_KEY_CHARS = 8;
const TOKEN_LIKE = /\b(?:Bearer\s+\S+|sk-[\w-]{8,})/gi;

/** A service's error text can echo what it received, headers included: the API key and anything
 *  shaped like a bearer token or an sk- key is removed, and the text is cut and kept to one line. */
export function scrubServiceText(text: string, apiKey: string | undefined): string {
  const hidden = apiKey && apiKey.length >= MIN_KEY_CHARS ? text.split(apiKey).join('[key]') : text;
  const clean = hidden.replace(TOKEN_LIKE, '[key]').replace(/\s+/g, ' ').trim();
  return clean.length > SERVICE_TEXT_CHARS ? `${clean.slice(0, SERVICE_TEXT_CHARS)}…` : clean;
}

/** The message of a JSON error body (`{"error":{"message":…}}`), read from at most 2 KB. */
async function serviceMessage(response: Response): Promise<string | undefined> {
  try {
    const text = (await response.text()).slice(0, 2048);
    const raw = JSON.parse(text) as { error?: { message?: unknown } | string };
    const message = typeof raw.error === 'string' ? raw.error : raw.error?.message;
    return typeof message === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
}

export class EndpointRuntime implements ModelRuntime {
  private connected = false;

  constructor(
    private readonly config: EndpointConfig,
    private readonly fetchFn: FetchLike,
  ) {}

  async load(
    _modelId: string,
    onProgress: (progress: LoadProgress) => void,
    cancel?: CancelSignal,
  ): Promise<void> {
    const problem = endpointUrlProblem(this.config.url);
    if (problem) throw new Error(problem);
    const timeout = AbortSignal.timeout(LOAD_TIMEOUT_MS);
    const stop = asAbortSignal(cancel);
    const signal = stop ? AbortSignal.any([timeout, stop]) : timeout;
    const response = await this.send('/models', { method: 'GET', signal });
    if (!response.ok) throw await this.refusal(response);
    this.connected = true;
    onProgress({ fraction: 1, text: `Connected to ${this.config.url}` });
  }

  async chat(request: ChatRequest): Promise<string> {
    if (!this.connected) throw new Error('The endpoint is not connected. Press Start first.');
    const signal = asAbortSignal(request.signal);
    const response = await this.send('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(this.body(request)),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok || !response.body) throw await this.refusal(response);
    return this.read(response.body, request, signal);
  }

  unload(): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }

  capabilities(): ModelCapabilities {
    const contextTokens = this.config.contextTokens ?? DEFAULT_CONTEXT_TOKENS;
    return { nativeToolCalls: false, jsonConstraint: false, contextTokens };
  }

  private body(request: ChatRequest): object {
    return {
      model: this.config.model,
      stream: true,
      stream_options: { include_usage: true },
      temperature: TEMPERATURE,
      messages: toRuntimeMessages(request.messages),
    };
  }

  private async refusal(response: Response): Promise<Error> {
    const hint = response.status === 403 ? FORBIDDEN_HINT : '';
    const said = await serviceMessage(response);
    const service = said ? ` It says: ${scrubServiceText(said, this.config.apiKey)}` : '';
    return new Error(`The endpoint answered ${response.status}.${service}${hint}`);
  }

  private async read(
    body: ReadableStream<Uint8Array>,
    request: ChatRequest,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    const reply = { text: '', usage: undefined as ModelUsage | undefined };
    try {
      for await (const event of sseEvents(body)) this.take(event, reply, request);
    } catch (error) {
      if (signal?.aborted !== true) throw error;
    }
    if (reply.usage) request.onUsage?.(reply.usage);
    return reply.text;
  }

  private take(
    event: StreamEvent,
    reply: { text: string; usage: ModelUsage | undefined },
    request: ChatRequest,
  ): void {
    if (event.failure !== undefined) throw new Error(this.failureText(event.failure));
    reply.usage = event.usage ?? reply.usage;
    reply.text += event.content;
    if (event.content) request.onToken?.(event.content);
  }

  private failureText(said: string): string {
    return `The endpoint reported an error: ${scrubServiceText(said, this.config.apiKey)}`;
  }

  private timeoutText(): string {
    return `WebAIAssist could not reach ${this.config.url}: no answer in ${LOAD_TIMEOUT_MS / 1000} seconds.`;
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    const url = `${this.config.url.replace(/\/+$/, '')}${path}`;
    try {
      return await this.fetchFn(url, { ...init, headers, redirect: 'error' });
    } catch (error) {
      if (timedOut(init.signal)) throw new Error(this.timeoutText());
      if (init.signal?.aborted === true) throw error;
      const why = scrubServiceText(errorText(error), this.config.apiKey);
      throw new Error(`WebAIAssist could not reach ${this.config.url}: ${why}`);
    }
  }
}
