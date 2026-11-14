// SPDX-License-Identifier: Apache-2.0
// The model host side of the model port: runs in the offscreen document (or, as the
// fallback, in the service worker), owns one ModelRuntime, and answers model/* messages
// from the side panel. Every message is checked against its schema. A load or chat request
// that fails the check still gets an error reply when it carries a usable id, so the panel
// never waits for an answer that will not come. model/cancel stops a download; model/stop
// stops a reply. The model stays loaded when the panel closes.
import type { ModelRuntime } from '../core/ports/model-runtime';
import type { ModelChatRequest, ModelLoadRequest } from '../protocol/messages';
import { parseMessage } from '../protocol/validate';
import { DEVICE_LOST } from './model-errors';

/** The part of chrome.runtime.Port the model port uses. */
export interface PortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  readonly onMessage: { addListener(listener: (message: unknown) => void): void };
  readonly onDisconnect: { addListener(listener: () => void): void };
}

export const MODEL_PORT_PREFIX = 'model-host:';
export const CANCELLED = 'The download was cancelled.';

export { DEVICE_LOST };
const MAX_ID = 64;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function safePost(port: PortLike, message: object): void {
  try {
    port.postMessage(message);
  } catch {
    // The panel closed; nothing is waiting for this message.
  }
}

/** Running loads and chats by request id, so cancel, stop and a closed port reach them. */
type Running = Map<string, AbortController>;

/** One served port: where answers go, the runtime behind it, what a failure text is told to. */
interface Served {
  readonly port: PortLike;
  readonly runtime: ModelRuntime;
  readonly failed: (text: string) => void;
}

async function load(served: Served, request: ModelLoadRequest, signal: AbortSignal) {
  const { port, runtime, failed } = served;
  const { id } = request;
  try {
    await runtime.load(
      request.modelId,
      (p) => safePost(port, { type: 'model/progress', id, fraction: p.fraction, text: p.text }),
      signal,
    );
    if (signal.aborted) throw new Error(CANCELLED);
    const where = runtime.where?.();
    safePost(port, { type: 'model/load-result', id, ok: true, ...(where ? { where } : {}) });
  } catch (error) {
    const text = signal.aborted ? CANCELLED : errorText(error);
    safePost(port, { type: 'model/load-result', id, ok: false, error: text });
    if (!signal.aborted) failed(text);
  }
}

async function chat(served: Served, request: ModelChatRequest, signal: AbortSignal) {
  const { port, runtime, failed } = served;
  const { id } = request;
  try {
    const text = await runtime.chat({
      messages: request.messages,
      ...(request.jsonSchema ? { jsonSchema: request.jsonSchema } : {}),
      signal,
      onToken: (token) => safePost(port, { type: 'model/token', id, token }),
    });
    safePost(port, { type: 'model/chat-result', id, ok: true, text });
  } catch (error) {
    const text = errorText(error);
    safePost(port, { type: 'model/chat-result', id, ok: false, text });
    if (!signal.aborted) failed(text);
  }
}

/** The error reply to a load or chat request that failed its check, when it has an id. */
function refusal(raw: unknown, why: string): object | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { type, id } = raw as { type?: unknown; id?: unknown };
  if (typeof id !== 'string' || id === '' || id.length > MAX_ID) return undefined;
  const text = `The model host refused the request: ${why.slice(0, 200)}`;
  if (type === 'model/chat') return { type: 'model/chat-result', id, ok: false, text };
  if (type === 'model/load') return { type: 'model/load-result', id, ok: false, error: text };
  return undefined;
}

function track(running: Running, id: string, task: (signal: AbortSignal) => Promise<void>): void {
  const controller = new AbortController();
  running.set(id, controller);
  void task(controller.signal).finally(() => running.delete(id));
}

/** Serves one panel port. `onDeviceLost` runs after the answer to a load or chat that failed
 *  because the GPU device is gone (DEVICE_LOST): the host restarts itself to get a new one. */
export function serveModelHost(
  port: PortLike,
  runtime: ModelRuntime,
  onDeviceLost?: () => void,
): void {
  const running: Running = new Map();
  const served: Served = {
    port,
    runtime,
    failed: (text) => {
      if (DEVICE_LOST.test(text)) onDeviceLost?.();
    },
  };
  port.onMessage.addListener((raw) => {
    const parsed = parseMessage(raw, 'offscreen');
    if (!parsed.ok) {
      const reply = refusal(raw, parsed.error);
      if (reply) safePost(port, reply);
      return;
    }
    const message = parsed.value;
    if (message.type === 'model/stop' || message.type === 'model/cancel') {
      running.get(message.id)?.abort();
    }
    if (message.type === 'model/load') {
      track(running, message.id, (signal) => load(served, message, signal));
    }
    if (message.type === 'model/chat') {
      track(running, message.id, (signal) => chat(served, message, signal));
    }
  });
  port.onDisconnect.addListener(() => running.forEach((controller) => controller.abort()));
}
