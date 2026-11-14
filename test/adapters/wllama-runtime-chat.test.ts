// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { type FakeEngine, noProgress, setup, SMALL } from './wllama-fakes';

describe('WllamaRuntime chat', () => {
  async function loaded() {
    const made = setup();
    await made.runtime.load(SMALL, noProgress);
    return { ...made, engine: made.engines[0] as FakeEngine };
  }

  it('streams the reply, hands over the schema and the turns, and merges a tool turn into a user turn', async () => {
    const { runtime, engine } = await loaded();
    const tokens: string[] = [];
    const schema = { type: 'object' };
    const text = await runtime.chat({
      messages: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'question' },
        { role: 'tool', content: 'result' },
      ],
      jsonSchema: schema,
      onToken: (t) => tokens.push(t),
    });
    expect(text).toBe('{"answer":"hi"}');
    expect(tokens).toEqual(['{"answer":', '"hi"}']);
    expect(engine.requests[0]).toMatchObject({
      messages: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'question\n\nresult' },
      ],
      jsonSchema: schema,
      thinkingSwitch: true,
    });
  });

  it('sends no schema when the request has none', async () => {
    const { runtime, engine } = await loaded();
    await runtime.chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(engine.requests[0]).not.toHaveProperty('jsonSchema');
  });

  it('returns what it has when Stop is pressed, without an error', async () => {
    const { runtime, engine } = await loaded();
    const stop = new AbortController();
    engine.chat = (request) => {
      engine.requests.push(request);
      return Promise.resolve(
        (async function* () {
          yield 'par';
          await Promise.resolve();
          stop.abort();
          throw new Error('Operation aborted');
        })(),
      );
    };
    await expect(runtime.chat({ messages: [], signal: stop.signal })).resolves.toBe('par');
  });

  it('passes a failure that is not a Stop on', async () => {
    const { runtime, engine } = await loaded();
    engine.chat = () => Promise.reject(new Error('kv cache full'));
    await expect(runtime.chat({ messages: [] })).rejects.toThrow('kv cache full');
  });

  it('says so when no model is loaded, and after unload', async () => {
    const { runtime, engine } = await loaded();
    await runtime.unload();
    expect(engine.exited).toBe(1);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow('No model is loaded.');
    await expect(setup().runtime.chat({ messages: [] })).rejects.toThrow('No model is loaded.');
  });

  it('constrains replies to a JSON schema and keeps the 4096-token window', async () => {
    const { runtime } = await loaded();
    expect(runtime.capabilities()).toEqual({
      nativeToolCalls: false,
      jsonConstraint: true,
      contextTokens: 4096,
    });
    expect(setup().runtime.where()).toBeUndefined();
  });
});
