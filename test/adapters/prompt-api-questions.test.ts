// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { PromptApiRuntime } from '../../src/adapters/prompt-api-runtime';
import { clock, FakeLanguageModel, FakeSession, flush, ID } from './prompt-api-fakes';

const SCHEMA = { type: 'object', required: ['answer'] };

describe('PromptApiRuntime reply constraint', () => {
  async function loaded(pieces: string[] = ['{"answer":"x"}']) {
    const lm = new FakeLanguageModel('available', pieces);
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    return { lm, runtime };
  }

  it('passes the action schema as responseConstraint and keeps it out of the context', async () => {
    const { lm, runtime } = await loaded();
    await runtime.chat({ messages: [{ role: 'user', content: 'Q' }], jsonSchema: SCHEMA });
    const options = lm.sessions[1]?.prompts[0]?.options as Record<string, unknown>;
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.responseConstraint).toBe(SCHEMA);
    expect(options.omitResponseConstraintInput).toBe(true);
    expect(Object.keys(options).sort()).toEqual([
      'omitResponseConstraintInput',
      'responseConstraint',
      'signal',
    ]);
  });

  it('sends no constraint when the request has no schema', async () => {
    const { lm, runtime } = await loaded();
    await runtime.chat({ messages: [{ role: 'user', content: 'Q' }] });
    expect(lm.sessions[1]?.prompts[0]?.options).not.toHaveProperty('responseConstraint');
  });

  it('retries without the constraint and returns that reply', async () => {
    const lm = new FakeLanguageModel('available', ['{"answer":"x"}']);
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    let first = true;
    const create = lm.create.bind(lm);
    lm.create = async (options) => {
      const session = (await create(options)) as FakeSession;
      if (first && lm.sessions.length > 1) {
        first = false;
        session.failPrompt = new DOMException('bad schema', 'SyntaxError');
      }
      return session;
    };
    const reply = await runtime.chat({
      messages: [{ role: 'user', content: 'Q' }],
      jsonSchema: SCHEMA,
    });
    expect(reply).toBe('{"answer":"x"}');
    expect(lm.sessions.at(-1)?.prompts[0]?.options).not.toHaveProperty('responseConstraint');
    expect(runtime.capabilities().jsonConstraint).toBe(false);
  });
});

describe('PromptApiRuntime when the input is over the window', () => {
  const quota = (requested: number, contextWindow: number) =>
    Object.assign(new DOMException('too long', 'QuotaExceededError'), { requested, contextWindow });
  const turn = (role: 'user' | 'assistant', n: number) => ({
    role,
    content: `${role} turn ${n} ${'word '.repeat(200)}`,
  });
  const history = [turn('user', 1), turn('assistant', 1), turn('user', 2), turn('assistant', 2)];

  async function loaded() {
    const lm = new FakeLanguageModel('available', ['{"answer":"ok"}']);
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    return { lm, runtime };
  }

  it('drops the oldest turns once, keeps the system prompt and the question, and answers', async () => {
    const { lm, runtime } = await loaded();
    lm.failCreates = [quota(4000, 2000)];
    const reply = await runtime.chat({
      messages: [
        { role: 'system', content: 'S' },
        ...history,
        { role: 'user', content: 'the question' },
      ],
    });
    expect(reply).toBe('{"answer":"ok"}');
    const kept = lm.creates.at(-1)?.initialPrompts as { role: string; content: string }[];
    expect(kept[0]).toEqual({ role: 'system', content: 'S' });
    expect(kept.length).toBeLessThan(5);
    expect(kept.at(1)?.role).not.toBe('assistant');
    expect(lm.sessions.at(-1)?.prompts[0]?.input).toBe('the question');
  });

  it('retries when the prompt itself is rejected, once, and then says how big it is', async () => {
    const { lm, runtime } = await loaded();
    lm.failPrompt = quota(4000, 2000);
    const error = await runtime
      .chat({
        messages: [{ role: 'system', content: 'S' }, ...history, { role: 'user', content: 'Q' }],
      })
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/too long for Chrome's built-in model.*4000.*2000/s);
    expect(lm.sessions.filter((s) => s.prompts.length > 0)).toHaveLength(2);
  });

  it('uses Chrome’s measure, when it has one, to cut the turns before asking', async () => {
    const { lm, runtime } = await loaded();
    const create = lm.create.bind(lm);
    lm.create = async (options) => {
      const session = (await create(options)) as FakeSession & {
        contextUsage: number;
        measureContextUsage: (input: string) => Promise<number>;
      };
      const turns = (options?.initialPrompts as unknown[] | undefined)?.length ?? 0;
      session.contextUsage = turns * 3000;
      session.measureContextUsage = () => Promise.resolve(200);
      return session;
    };
    await runtime.chat({
      messages: [{ role: 'system', content: 'S' }, ...history, { role: 'user', content: 'Q' }],
    });
    const asked = lm.sessions.filter((s) => s.prompts.length > 0);
    expect(asked).toHaveLength(1);
    expect((lm.creates.at(-1)?.initialPrompts as unknown[]).length).toBeLessThan(5);
  });

  it('says plainly how big the question is when even the question alone does not fit', async () => {
    const { lm, runtime } = await loaded();
    lm.failCreates = [quota(4000, 2000), quota(3000, 2000)];
    const error = await runtime
      .chat({ messages: [{ role: 'system', content: 'S' }, ...history, turn('user', 3)] })
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/too long for Chrome's built-in model.*3000.*2000/s);
    expect(lm.creates.filter((o) => 'initialPrompts' in o)).toHaveLength(2);
  });

  it('does not retry when only the system prompt and the question are left', async () => {
    const { lm, runtime } = await loaded();
    lm.failCreates = [quota(4000, 2000)];
    const error = await runtime
      .chat({
        messages: [
          { role: 'system', content: 'S' },
          { role: 'user', content: 'Q' },
        ],
      })
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/too long for Chrome's built-in model/);
    expect(lm.creates.filter((o) => 'initialPrompts' in o)).toHaveLength(1);
  });
});

describe('PromptApiRuntime unload', () => {
  it('destroys a session that is still answering', async () => {
    const lm = new FakeLanguageModel('available');
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    const never = new Promise<string>(() => undefined);
    lm.create = (options) => {
      const session = new FakeSession([]);
      lm.sessions.push(session);
      session.promptStreaming = () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => never.then(() => ({ done: true, value: '' })),
        }),
      });
      void options;
      return Promise.resolve(session);
    };
    void runtime.chat({ messages: [{ role: 'user', content: 'Q' }] }).catch(() => undefined);
    await flush();
    await runtime.unload();
    expect(lm.sessions.at(-1)?.destroyed).toBe(true);
  });

  it('turns a chat after unload into the "not loaded" error', async () => {
    const runtime = new PromptApiRuntime(new FakeLanguageModel('available'), clock().options);
    await runtime.load(ID, () => {});
    await runtime.unload();
    await expect(runtime.chat({ messages: [{ role: 'user', content: 'Q' }] })).rejects.toThrow(
      /not loaded/,
    );
  });
});
