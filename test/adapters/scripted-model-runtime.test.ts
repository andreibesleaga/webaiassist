// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { REPAIR } from '../../src/core/check-action';
import { NUDGE } from '../../src/core/repeat';
import { AFTER_RESULT } from '../../src/core/tool-rules';
import { wrapUntrusted } from '../../src/core/untrusted';
import { ScriptedModelRuntime } from '../../src/fakes/scripted-model-runtime';

const user = (content: string) => ({ role: 'user' as const, content });

describe('ScriptedModelRuntime (smoke-test build only)', () => {
  it('turns "/tool name {json}" into one tool call', async () => {
    const model = new ScriptedModelRuntime();
    await model.load('scripted-test-model', () => {});
    const reply = await model.chat({ messages: [user('/tool add {"a":2,"b":3}')] });
    expect(JSON.parse(reply)).toEqual({ tool: 'add', arguments: { a: 2, b: 3 } });
  });

  it('answers with the text of the last tool result', async () => {
    const model = new ScriptedModelRuntime();
    const tokens: string[] = [];
    const reply = await model.chat({
      messages: [
        user('/tool add {"a":2,"b":3}'),
        { role: 'tool', content: wrapUntrusted('add', '5') },
      ],
      onToken: (t) => tokens.push(t),
    });
    expect(JSON.parse(reply)).toEqual({ answer: 'The tool said: 5' });
    expect(tokens.join('')).toBe(reply);
  });

  it('ignores the line the loop adds after a tool result', async () => {
    const model = new ScriptedModelRuntime();
    const reply = await model.chat({
      messages: [
        user('/tool add {"a":2,"b":3}'),
        { role: 'tool', content: wrapUntrusted('add', '5') },
        user(AFTER_RESULT),
      ],
    });
    expect(JSON.parse(reply)).toEqual({ answer: 'The tool said: 5' });
  });

  it('echoes any other question, and a denial', async () => {
    const model = new ScriptedModelRuntime();
    expect(JSON.parse(await model.chat({ messages: [user('hello')] }))).toEqual({
      answer: 'Scripted reply to: hello',
    });
    const denied = { role: 'tool' as const, content: 'The user denied the call to "add".' };
    expect(JSON.parse(await model.chat({ messages: [user('/tool add'), denied] }))).toEqual({
      answer: 'The tool said: The user denied the call to "add".',
    });
    expect(model.capabilities().nativeToolCalls).toBe(false);
    await model.unload();
  });

  it('"/loop name {json}" asks for a tool at every step, each time with new arguments', async () => {
    const model = new ScriptedModelRuntime();
    const question = user('/loop echo {"text":"x"}');
    const first = JSON.parse(await model.chat({ messages: [question] })) as { arguments: object };
    const result = { role: 'tool' as const, content: wrapUntrusted('echo', 'x') };
    const next = await model.chat({ messages: [question, result] });
    const third = await model.chat({ messages: [question, result, result] });
    expect(first).toEqual({ tool: 'echo', arguments: { text: 'x', step: 0 } });
    expect(JSON.parse(next)).toEqual({ tool: 'echo', arguments: { text: 'x', step: 1 } });
    expect(JSON.parse(third)).toMatchObject({ arguments: { step: 2 } });
  });

  it('"/repeat name {json}" asks for the same call again, whatever it is told', async () => {
    const model = new ScriptedModelRuntime();
    const question = user('/repeat echo {"text":"x"}');
    const result = { role: 'tool' as const, content: wrapUntrusted('echo', 'x') };
    const nudge = { role: 'user' as const, content: NUDGE };
    const call = { tool: 'echo', arguments: { text: 'x' } };
    expect(JSON.parse(await model.chat({ messages: [question] }))).toEqual(call);
    expect(JSON.parse(await model.chat({ messages: [question, result] }))).toEqual(call);
    expect(JSON.parse(await model.chat({ messages: [question, result, nudge] }))).toEqual(call);
  });

  it('answers a repair request by sending the same tool call again', async () => {
    const model = new ScriptedModelRuntime();
    const question = user('/tool add {"a":"x"}');
    const repair = {
      role: 'user' as const,
      content: REPAIR.replace('%s', 'the arguments are bad'),
    };
    const reply = await model.chat({ messages: [question, repair] });
    expect(JSON.parse(reply)).toEqual({ tool: 'add', arguments: { a: 'x' } });
  });

  it('"/fail text" and "/lost" make the model itself fail, for the error banner scenarios', async () => {
    const model = new ScriptedModelRuntime();
    await expect(model.chat({ messages: [user('/fail the model crashed')] })).rejects.toThrow(
      'the model crashed',
    );
    await expect(model.chat({ messages: [user('/lost')] })).rejects.toThrow(
      /DXGI_ERROR_DEVICE_REMOVED/,
    );
  });
});
