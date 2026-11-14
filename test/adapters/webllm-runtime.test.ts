// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { WebLlmEngineLike, WebLlmRequest } from '../../src/adapters/webllm-runtime';
import { WebLlmRuntime } from '../../src/adapters/webllm-runtime';
import type { LoadProgress } from '../../src/core/ports/model-runtime';
import { items } from './runtime-helpers';

const LLAMA = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const QWEN = 'Qwen3-0.6B-q4f16_1-MLC';

class FakeEngine implements WebLlmEngineLike {
  readonly requests: WebLlmRequest[] = [];
  interrupted = 0;
  unloaded = 0;
  constructor(
    private readonly pieces: string[],
    private readonly onPiece?: (index: number) => void,
  ) {}
  readonly chat = {
    completions: {
      create: (request: WebLlmRequest) => {
        this.requests.push(request);
        const chunks = this.pieces.map((content) => ({ choices: [{ delta: { content } }] }));
        return Promise.resolve(items(chunks, this.onPiece));
      },
    },
  };
  interruptGenerate(): void {
    this.interrupted += 1;
  }
  unload(): Promise<void> {
    this.unloaded += 1;
    return Promise.resolve();
  }
}

function runtimeWith(engine: FakeEngine, loaded: string[] = []) {
  return new WebLlmRuntime((modelId, onProgress) => {
    loaded.push(modelId);
    onProgress({ progress: 0.5, text: 'Fetching weights' });
    onProgress({ progress: 1, text: 'Ready' });
    return Promise.resolve(engine);
  });
}

describe('WebLlmRuntime', () => {
  it('loads one of the two shipped models and reports download progress', async () => {
    const loaded: string[] = [];
    const runtime = runtimeWith(new FakeEngine([]), loaded);
    const progress: LoadProgress[] = [];
    await runtime.load(LLAMA, (p) => progress.push(p));
    expect(loaded).toEqual([LLAMA]);
    expect(progress).toEqual([
      { fraction: 0.5, text: 'Fetching weights' },
      { fraction: 1, text: 'Ready' },
    ]);
  });

  it('refuses a model whose library is not inside the package (no remote code)', async () => {
    const loaded: string[] = [];
    const runtime = runtimeWith(new FakeEngine([]), loaded);
    await expect(runtime.load('Phi-3.5-mini-instruct-q4f16_1-MLC', () => {})).rejects.toThrow(
      /not one of the models this version ships/,
    );
    await expect(runtime.load('../evil id', () => {})).rejects.toThrow(/not one of the models/);
    expect(loaded).toEqual([]);
  });

  it('streams tokens and returns the reply, with no grammar (WebLLM refused a schema object)', async () => {
    const engine = new FakeEngine(['{"answer":', ' "hi"}']);
    const runtime = runtimeWith(engine);
    await runtime.load(LLAMA, () => {});
    const tokens: string[] = [];
    const reply = await runtime.chat({
      messages: [{ role: 'user', content: 'hello' }],
      jsonSchema: { type: 'object' },
      onToken: (t) => tokens.push(t),
    });
    expect(reply).toBe('{"answer": "hi"}');
    expect(tokens).toEqual(['{"answer":', ' "hi"}']);
    expect(engine.requests[0]).toEqual({
      stream: true,
      temperature: 0.2,
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(engine.requests[0]).not.toHaveProperty('response_format');
  });

  it('turns off thinking for Qwen3 and sends no format without a schema', async () => {
    const engine = new FakeEngine(['ok']);
    const runtime = runtimeWith(engine);
    await runtime.load(QWEN, () => {});
    await runtime.chat({ messages: [{ role: 'user', content: 'x' }] });
    expect(engine.requests[0]?.extra_body).toEqual({ enable_thinking: false });
    expect(engine.requests[0]).not.toHaveProperty('response_format');
  });

  it('stops the engine when the signal aborts during a reply', async () => {
    const controller = new AbortController();
    const engine = new FakeEngine(['a', 'b', 'c'], (i) => {
      if (i === 1) controller.abort();
    });
    const runtime = runtimeWith(engine);
    await runtime.load(LLAMA, () => {});
    await runtime.chat({ messages: [{ role: 'user', content: 'x' }], signal: controller.signal });
    expect(engine.interrupted).toBe(1);
  });

  it('refuses to chat before a model is loaded', async () => {
    const runtime = runtimeWith(new FakeEngine([]));
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/No model is loaded/);
  });

  it('unloads the previous engine before loading another, and on unload', async () => {
    const engine = new FakeEngine([]);
    const runtime = runtimeWith(engine);
    await runtime.load(LLAMA, () => {});
    await runtime.load(QWEN, () => {});
    expect(engine.unloaded).toBe(1);
    await runtime.unload();
    expect(engine.unloaded).toBe(2);
    await runtime.unload();
    expect(engine.unloaded).toBe(2);
  });

  it('says where the engine runs, as the factory reports it', async () => {
    const engine = Object.assign(new FakeEngine([]), { where: 'offscreen-main' });
    const runtime = runtimeWith(engine);
    expect(runtime.where()).toBeUndefined();
    await runtime.load(QWEN, () => {});
    expect(runtime.where()).toBe('offscreen-main');
    await runtime.unload();
    expect(runtime.where()).toBeUndefined();
  });

  it('reports prompted JSON, no native tool calls, a 4096-token context', () => {
    expect(runtimeWith(new FakeEngine([])).capabilities()).toEqual({
      nativeToolCalls: false,
      jsonConstraint: false,
      contextTokens: 4096,
    });
  });
});

describe('WebLlmRuntime: cancelling a download', () => {
  it('passes the signal to the factory, unloads and refuses a cancelled load', async () => {
    const engine = new FakeEngine([]);
    const cancel = new AbortController();
    let seen: AbortSignal | undefined;
    const runtime = new WebLlmRuntime((_id, _progress, signal) => {
      seen = signal;
      cancel.abort();
      return Promise.resolve(engine);
    });
    await expect(runtime.load(QWEN, () => undefined, cancel.signal)).rejects.toThrow(/cancelled/);
    expect(seen?.aborted).toBe(true);
    expect(engine.unloaded).toBe(1);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/No model/);
  });

  it('keeps a model that is already loaded: Start again (a reopened panel) is at once ready', async () => {
    const engine = new FakeEngine([]);
    const loaded: string[] = [];
    const runtime = runtimeWith(engine, loaded);
    await runtime.load(QWEN, () => undefined);
    const progress: LoadProgress[] = [];
    await runtime.load(QWEN, (p) => progress.push(p));
    expect(loaded).toEqual([QWEN]);
    expect(engine.unloaded).toBe(0);
    expect(progress).toEqual([{ fraction: 1, text: 'Ready' }]);
  });

  it('runs one load at a time: a second Start cancels the load still running and waits for it', async () => {
    const first = new FakeEngine([]);
    const second = new FakeEngine([]);
    const order: string[] = [];
    const runtime = new WebLlmRuntime((modelId, _progress, signal) => {
      order.push(`start ${modelId}`);
      if (modelId === LLAMA) {
        return new Promise((resolve) => {
          signal?.addEventListener('abort', () => {
            order.push('first cancelled');
            resolve(first);
          });
        });
      }
      return Promise.resolve(second);
    });
    const slow = runtime.load(LLAMA, () => undefined);
    await new Promise((done) => setTimeout(done, 0)); // the first load has reached the factory
    await runtime.load(QWEN, () => undefined);
    await expect(slow).rejects.toThrow(/cancelled/);
    expect(order).toEqual([`start ${LLAMA}`, 'first cancelled', `start ${QWEN}`]);
    expect(first.unloaded).toBe(1);
    expect(second.unloaded).toBe(0);
    await runtime.chat({ messages: [] });
    expect(second.requests).toHaveLength(1);
  });

  it('never starts a load that was cancelled while it waited its turn', async () => {
    const loaded: string[] = [];
    const engine = new FakeEngine([]);
    const runtime = runtimeWith(engine, loaded);
    const cancel = new AbortController();
    const waiting = runtime.load(LLAMA, () => undefined, cancel.signal);
    cancel.abort();
    await expect(waiting).rejects.toThrow(/cancelled/);
    expect(loaded).toEqual([]);
  });
});

describe('WebLlmRuntime: an engine that is gone', () => {
  /** An engine whose chat fails the way WebLLM's does after a lost GPU device (measured 14 Nov 2026). */
  class GoneEngine extends FakeEngine {
    constructor(private readonly why: string) {
      super([]);
      this.chat.completions.create = () => Promise.reject(new Error(this.why));
    }
  }
  const NOT_LOADED_TEXT =
    'ModelNotLoadedError: Model not loaded before trying to complete ChatCompletionRequest. Please ensure you have called MLCEngine.reload(model) to load the model before initiating APIs.';

  it('says the model stopped, in plain words, when WebLLM no longer has it loaded', async () => {
    const runtime = new WebLlmRuntime(() => Promise.resolve(new GoneEngine(NOT_LOADED_TEXT)));
    await runtime.load(LLAMA, () => undefined);
    const failure = runtime.chat({ messages: [{ role: 'user', content: 'x' }] });
    await expect(failure).rejects.toThrow('The model stopped. Press Start to load it again.');
    await expect(failure).rejects.not.toThrow(/ModelNotLoadedError|MLCEngine/);
  });

  it('lets go of the dead engine, so the next Start loads the model again', async () => {
    const loaded: string[] = [];
    const runtime = new WebLlmRuntime((id) => {
      loaded.push(id);
      return Promise.resolve(new GoneEngine(NOT_LOADED_TEXT));
    });
    await runtime.load(LLAMA, () => undefined);
    await runtime.chat({ messages: [] }).catch(() => undefined);
    expect(runtime.where()).toBeUndefined();
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/No model is loaded/);
    await runtime.load(LLAMA, () => undefined);
    expect(loaded).toEqual([LLAMA, LLAMA]);
  });

  it('does the same when the call in flight reads an object freed by a lost device', async () => {
    const loaded: string[] = [];
    const runtime = new WebLlmRuntime((id) => {
      loaded.push(id);
      return Promise.resolve(new GoneEngine('Error: Object has already been disposed'));
    });
    await runtime.load(LLAMA, () => undefined);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/already been disposed/);
    await runtime.load(LLAMA, () => undefined);
    expect(loaded).toEqual([LLAMA, LLAMA]);
  });

  it('keeps the engine after an ordinary failure', async () => {
    const loaded: string[] = [];
    const runtime = new WebLlmRuntime((id) => {
      loaded.push(id);
      return Promise.resolve(new GoneEngine('out of memory'));
    });
    await runtime.load(LLAMA, () => undefined);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow('out of memory');
    await runtime.load(LLAMA, () => undefined);
    expect(loaded).toEqual([LLAMA]);
  });
});
