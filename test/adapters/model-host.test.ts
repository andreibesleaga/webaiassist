// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { CANCELLED, serveModelHost } from '../../src/adapters/model-host';
import { PortModelRuntime } from '../../src/adapters/port-model-runtime';
import type { ChatRequest, LoadProgress, ModelRuntime } from '../../src/core/ports/model-runtime';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { portPair, type MemoryPort } from './port-pair';

/** A runtime whose reply streams two tokens, then waits until it is stopped. */
class StoppableRuntime extends FakeModelRuntime {
  stopped = false;
  override chat(request: ChatRequest): Promise<string> {
    request.onToken?.('par');
    request.onToken?.('tial');
    const signal = request.signal as AbortSignal;
    return new Promise((resolve) => {
      signal.addEventListener('abort', () => {
        this.stopped = true;
        resolve('partial');
      });
    });
  }
}

class FailingRuntime extends FakeModelRuntime {
  override load(): Promise<void> {
    return Promise.reject(new Error('no WebGPU adapter'));
  }
  override chat(): Promise<string> {
    return Promise.reject(new Error('out of memory'));
  }
}

function connect(
  runtime: ModelRuntime,
  onDeviceLost?: () => void,
): { client: PortModelRuntime; ports: MemoryPort[] } {
  const ports: MemoryPort[] = [];
  let n = 0;
  const client = new PortModelRuntime(
    () => {
      const [panelSide, hostSide] = portPair();
      serveModelHost(hostSide, runtime, onDeviceLost);
      ports.push(panelSide, hostSide);
      return panelSide;
    },
    () => `r${(n += 1)}`,
  );
  return { client, ports };
}

describe('model host and PortModelRuntime', () => {
  it('loads a model in the host and forwards the download progress', async () => {
    const runtime = new FakeModelRuntime(['x']);
    const { client } = connect(runtime);
    const progress: LoadProgress[] = [];
    await client.load('Qwen3-0.6B-q4f16_1-MLC', (p) => progress.push(p));
    expect(runtime.loadedModel).toBe('Qwen3-0.6B-q4f16_1-MLC');
    expect(progress).toEqual([{ fraction: 1, text: 'loaded Qwen3-0.6B-q4f16_1-MLC' }]);
  });

  it('streams tokens back and resolves with the reply', async () => {
    const runtime = new FakeModelRuntime(['{"answer":"hi"}']);
    const { client } = connect(runtime);
    const tokens: string[] = [];
    const reply = await client.chat({
      messages: [{ role: 'user', content: 'hello' }],
      jsonSchema: { type: 'object' },
      onToken: (t) => tokens.push(t),
    });
    expect(reply).toBe('{"answer":"hi"}');
    expect(tokens).toEqual(['{"answer":"hi"}']);
    expect(runtime.requests[0]?.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(runtime.requests[0]?.jsonSchema).toEqual({ type: 'object' });
  });

  it('sends model/stop when the signal aborts, and the host stops the runtime', async () => {
    const runtime = new StoppableRuntime(['x']);
    const { client, ports } = connect(runtime);
    const controller = new AbortController();
    const tokens: string[] = [];
    const pending = client.chat({
      messages: [{ role: 'user', content: 'q' }],
      signal: controller.signal,
      onToken: (t) => {
        tokens.push(t);
        if (tokens.length === 2) controller.abort();
      },
    });
    expect(await pending).toBe('partial');
    expect(runtime.stopped).toBe(true);
    expect(ports[0]?.sent.map((m) => (m as { type: string }).type)).toContain('model/stop');
  });

  it('tells the host when the GPU device is gone, after answering the panel', async () => {
    class LostDevice extends FakeModelRuntime {
      override load(): Promise<void> {
        return Promise.reject(
          new Error(
            "Failed to execute 'requestDevice' on 'GPUAdapter': D3D12 create command queue failed with DXGI_ERROR_DEVICE_REMOVED (0x887A0005)",
          ),
        );
      }
    }
    let lost = 0;
    const { client } = connect(new LostDevice([]), () => (lost += 1));
    await expect(client.load('Qwen3-0.6B-q4f16_1-MLC', () => undefined)).rejects.toThrow(
      /DEVICE_REMOVED/,
    );
    expect(lost).toBe(1);
    const { client: other } = connect(new FailingRuntime([]), () => (lost += 1));
    await expect(other.load('Qwen3-0.6B-q4f16_1-MLC', () => undefined)).rejects.toThrow(/WebGPU/);
    expect(lost).toBe(1);
  });

  it('counts "Object has already been disposed" in a reply as a lost device: the host restarts', async () => {
    class FreedObjects extends FakeModelRuntime {
      override chat(): Promise<string> {
        return Promise.reject(new Error('Error: Object has already been disposed'));
      }
    }
    let lost = 0;
    const { client } = connect(new FreedObjects([]), () => (lost += 1));
    await expect(client.chat({ messages: [] })).rejects.toThrow(/already been disposed/);
    expect(lost).toBe(1);
  });

  it('turns host errors into rejected promises with the host’s message', async () => {
    const { client } = connect(new FailingRuntime([]));
    await expect(client.load('m', () => {})).rejects.toThrow('no WebGPU adapter');
    await expect(client.chat({ messages: [] })).rejects.toThrow('out of memory');
  });

  it('rejects what is pending when the host goes away, then reconnects', async () => {
    const runtime = new StoppableRuntime(['x']);
    const { client, ports } = connect(runtime);
    const pending = client.chat({ messages: [], signal: new AbortController().signal });
    await Promise.resolve();
    ports[1]?.disconnect();
    await expect(pending).rejects.toThrow(/model host closed/);
    const second = connect(new FakeModelRuntime(['ok']));
    expect(await second.client.chat({ messages: [] })).toBe('ok');
    await client.unload();
    expect(ports).toHaveLength(2);
  });

  it('runs nothing that fails its schema; a refused chat or load still gets an error', async () => {
    const [panelSide, hostSide] = portPair();
    const runtime = new FakeModelRuntime(['x']);
    serveModelHost(hostSide, runtime);
    panelSide.postMessage({ type: 'model/chat', id: 'a', messages: [{ role: 'root' }] });
    panelSide.postMessage({ type: 'model/load', id: 'd', modelId: '' });
    panelSide.postMessage({ type: 'model/chat', id: 'x'.repeat(65), messages: [] });
    panelSide.postMessage({ type: 'tools/call', id: 'b', name: 'x', args: {} });
    panelSide.postMessage({ type: 'model/stop', id: 'nothing-running' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.requests).toHaveLength(0);
    expect(hostSide.sent).toEqual([
      expect.objectContaining({ type: 'model/chat-result', id: 'a', ok: false }),
      expect.objectContaining({ type: 'model/load-result', id: 'd', ok: false }),
    ]);
    hostSide.sent.length = 0;
    panelSide.onMessage.addListener(() => undefined);
    panelSide.postMessage({ type: 'model/load', id: 'c', modelId: 'm' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hostSide.sent.at(-1)).toEqual({ type: 'model/load-result', id: 'c', ok: true });
  });

  it('passes on where the model runs, and the panel reads it after the load', async () => {
    class Placed extends FakeModelRuntime {
      where(): string {
        return 'offscreen-main';
      }
    }
    const { client, ports } = connect(new Placed([]));
    expect(client.where()).toBeUndefined();
    await client.load('m', () => {});
    expect(ports[1]?.sent.at(-1)).toMatchObject({ ok: true, where: 'offscreen-main' });
    expect(client.where()).toBe('offscreen-main');
  });

  it('reports what the shipped models can do', () => {
    expect(connect(new FakeModelRuntime([])).client.capabilities()).toEqual({
      nativeToolCalls: false,
      jsonConstraint: false,
      contextTokens: 4096,
    });
  });
});

describe('PortModelRuntime capabilities', () => {
  it('reports the capabilities the panel gives it (the processor runtime constrains its replies)', () => {
    const caps = { nativeToolCalls: false, jsonConstraint: true, contextTokens: 4096 };
    const client = new PortModelRuntime(
      () => portPair()[0],
      () => 'r1',
      caps,
    );
    expect(client.capabilities()).toEqual(caps);
  });
});

/** A runtime whose load waits until it is cancelled. */
class SlowLoadRuntime extends FakeModelRuntime {
  override load(
    _id: string,
    onProgress: (p: LoadProgress) => void,
    signal?: unknown,
  ): Promise<void> {
    onProgress({ fraction: 0.1, text: 'downloading' });
    return new Promise((resolve) => {
      (signal as AbortSignal).addEventListener('abort', () => resolve());
    });
  }
}

describe('model host: cancelling a download', () => {
  it('Cancel sends model/cancel and the load ends with "cancelled"', async () => {
    const { client, ports } = connect(new SlowLoadRuntime([]));
    const cancel = new AbortController();
    const loading = client.load('Qwen3-0.6B-q4f16_1-MLC', () => undefined, cancel.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    cancel.abort();
    await expect(loading).rejects.toThrow(CANCELLED);
    expect(ports[0]?.sent).toContainEqual({ type: 'model/cancel', id: 'r1' });
  });
});
