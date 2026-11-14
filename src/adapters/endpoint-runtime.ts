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

/** The content pieces of a chat-completions event stream (data: lines, ended by [DONE]). */
async function* sseContent(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
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
      const piece = readLine(line.trim());
      if (piece === null) return;
      if (piece) yield piece;
    }
  }
}

/** The content of one line; null at [DONE]; '' for anything else. */
function readLine(line: string): string | null {
  if (!line.startsWith('data:')) return '';
  const data = line.slice(5).trim();
  if (data === '[DONE]') return null;
  try {
    const event = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] };
    const content = event.choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : '';
  } catch {
    return '';
  }
}

/** Ollama refuses origins it does not list, and lists no extension origin by default. */
const FORBIDDEN_HINT =
  ' Ollama refuses extensions unless it is started with OLLAMA_ORIGINS=chrome-extension://*.';

function refusal(status: number): string {
  return `The endpoint answered ${status}.${status === 403 ? FORBIDDEN_HINT : ''}`;
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
    if (!response.ok) throw new Error(refusal(response.status));
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
    if (!response.ok || !response.body) throw new Error(refusal(response.status));
    return this.read(response.body, request.onToken, signal);
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
      temperature: TEMPERATURE,
      messages: toRuntimeMessages(request.messages),
    };
  }

  private async read(
    body: ReadableStream<Uint8Array>,
    onToken: ((token: string) => void) | undefined,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    let text = '';
    try {
      for await (const piece of sseContent(body)) {
        text += piece;
        onToken?.(piece);
      }
    } catch (error) {
      if (signal?.aborted !== true) throw error;
    }
    return text;
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
      throw new Error(`WebAIAssist could not reach ${this.config.url}: ${errorText(error)}`);
    }
  }
}
