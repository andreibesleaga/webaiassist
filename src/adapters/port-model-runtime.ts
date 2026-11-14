// SPDX-License-Identifier: Apache-2.0
// ModelRuntime adapter for the side panel: the model runs in another part of the
// extension (the offscreen document, or the service worker), reached through a
// chrome.runtime port. Tokens and progress stream back; Stop sends model/stop.
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
} from '../core/ports/model-runtime';
import type { CancelSignal } from '../core/types';
import type { Message } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';
import { asAbortSignal } from './chat-messages';
import type { PortLike } from './model-host';

/** The graphics-card models: prompted JSON (no grammar) in a 4096-token window. */
const SHIPPED_CAPABILITIES: ModelCapabilities = {
  nativeToolCalls: false,
  jsonConstraint: false,
  contextTokens: 4096,
};

type Handler = (message: Message) => void;

interface Pending {
  readonly handle: Handler;
  readonly fail: (error: Error) => void;
}

export class PortModelRuntime implements ModelRuntime {
  private port: PortLike | undefined;
  private readonly pending = new Map<string, Pending>();
  private placed: string | undefined;

  constructor(
    private readonly connect: () => PortLike,
    private readonly newId: () => string,
    private readonly caps: ModelCapabilities = SHIPPED_CAPABILITIES,
  ) {}

  /** Cancel (the signal) sends model/cancel; the host stops the download and answers. */
  load(
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    cancel?: CancelSignal,
  ): Promise<void> {
    const id = this.newId();
    const signal = asAbortSignal(cancel);
    const stop = (): void => this.send({ type: 'model/cancel', id });
    signal?.addEventListener('abort', stop, { once: true });
    return this.request<void>(id, { type: 'model/load', id, modelId }, (message, done) => {
      if (message.type === 'model/progress') {
        onProgress({ fraction: message.fraction, text: message.text });
      }
      if (message.type !== 'model/load-result') return;
      this.placed = message.ok ? message.where : undefined;
      done(message.ok ? undefined : new Error(message.error ?? 'The model did not load.'));
    }).finally(() => signal?.removeEventListener('abort', stop));
  }

  chat(request: ChatRequest): Promise<string> {
    const id = this.newId();
    const signal = asAbortSignal(request.signal);
    const stop = (): void => this.send({ type: 'model/stop', id });
    signal?.addEventListener('abort', stop, { once: true });
    const body = {
      type: 'model/chat',
      id,
      messages: request.messages,
      ...(request.jsonSchema ? { jsonSchema: request.jsonSchema } : {}),
    };
    let text = '';
    return this.request<string>(id, body, (message, done) => {
      if (message.type === 'model/token') request.onToken?.(message.token);
      if (message.type !== 'model/chat-result') return;
      text = message.text;
      done(message.ok ? undefined : new Error(message.text));
    })
      .then(() => text)
      .finally(() => signal?.removeEventListener('abort', stop));
  }

  unload(): Promise<void> {
    this.port?.disconnect();
    this.port = undefined;
    return Promise.resolve();
  }

  capabilities(): ModelCapabilities {
    return this.caps;
  }

  /** Where the host said the model runs, after the last load. */
  where(): string | undefined {
    return this.placed;
  }

  private request<T>(
    id: string,
    body: object,
    step: (message: Message, done: (error?: Error) => void) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const done = (error?: Error): void => {
        this.pending.delete(id);
        if (error) reject(error);
        else resolve(undefined as T);
      };
      this.pending.set(id, { handle: (message) => step(message, done), fail: reject });
      this.send(body);
    });
  }

  private send(body: object): void {
    this.open().postMessage(body);
  }

  private open(): PortLike {
    if (this.port) return this.port;
    const port = this.connect();
    port.onMessage.addListener((raw) => this.dispatch(raw));
    port.onDisconnect.addListener(() => this.closed(port));
    this.port = port;
    return port;
  }

  private dispatch(raw: unknown): void {
    const parsed = parseMessage(raw, 'panel');
    if (!parsed.ok || !('id' in parsed.value)) return;
    this.pending.get(parsed.value.id)?.handle(parsed.value);
  }

  private closed(port: PortLike): void {
    if (this.port === port) this.port = undefined;
    const error = new Error('The model host closed. Load the model again.');
    this.pending.forEach((p) => p.fail(error));
    this.pending.clear();
  }
}
