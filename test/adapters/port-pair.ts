// SPDX-License-Identifier: Apache-2.0
// Two connected in-memory ports with the shape of chrome.runtime.Port. Messages are
// copied through JSON and delivered on a later microtask, as a real port would.
import type { PortLike } from '../../src/adapters/model-host';

type Listener<T extends unknown[]> = (...args: T) => void;

class Hub<T extends unknown[]> {
  private readonly listeners: Listener<T>[] = [];
  addListener(listener: Listener<T>): void {
    this.listeners.push(listener);
  }
  emit(...args: T): void {
    for (const listener of this.listeners) listener(...args);
  }
}

export class MemoryPort implements PortLike {
  peer: MemoryPort | undefined;
  readonly sent: unknown[] = [];
  readonly onMessage = new Hub<[unknown]>();
  readonly onDisconnect = new Hub<[]>();
  private open = true;

  postMessage(message: unknown): void {
    if (!this.open) throw new Error('Attempting to use a disconnected port object');
    this.sent.push(message);
    const copy: unknown = JSON.parse(JSON.stringify(message));
    const peer = this.peer;
    queueMicrotask(() => peer?.onMessage.emit(copy));
  }

  disconnect(): void {
    if (!this.open) return;
    this.open = false;
    const peer = this.peer;
    if (peer) peer.open = false;
    queueMicrotask(() => peer?.onDisconnect.emit());
  }
}

export function portPair(): [MemoryPort, MemoryPort] {
  const a = new MemoryPort();
  const b = new MemoryPort();
  a.peer = b;
  b.peer = a;
  return [a, b];
}
