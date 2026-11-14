// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { PromptApiRuntime } from '../../src/adapters/prompt-api-runtime';
import type { LoadProgress } from '../../src/core/ports/model-runtime';
import { clock, FakeLanguageModel, FakeSession, ID, LANGS } from './prompt-api-fakes';

describe('PromptApiRuntime load', () => {
  it('says the API is missing in this browser', async () => {
    await expect(new PromptApiRuntime(undefined).load(ID, () => {})).rejects.toThrow(
      /not in this browser/,
    );
  });

  it('calls create() first, inside the Start click, with a monitor, a signal and languages', async () => {
    const lm = new FakeLanguageModel('downloadable');
    await new PromptApiRuntime(lm, clock().options).load(ID, () => {});
    expect(lm.calls[0]).toBe('create');
    expect(lm.creates[0]).toMatchObject(LANGS);
    expect(lm.creates[0]?.monitor).toBeTypeOf('function');
    expect(lm.creates[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(lm.sessions[0]?.destroyed).toBe(true);
  });

  it('shows the download percentage, the preparing step and Chrome’s state', async () => {
    const lm = Object.assign(new FakeLanguageModel('downloading'), { hold: true });
    const timers = clock();
    const progress: LoadProgress[] = [];
    const loading = new PromptApiRuntime(lm, timers.options).load(ID, (p) => progress.push(p));
    await timers.fire();
    lm.progress?.({ loaded: 0.51 });
    lm.progress?.({ loaded: 1 });
    lm.settle?.resolve(new FakeSession([]));
    await loading;
    const texts = progress.map((p) => p.text);
    expect(texts.some((t) => /state: downloading/.test(t))).toBe(true);
    expect(texts).toContain("Chrome is downloading its model: 51% (Chrome's state: downloading)");
    expect(texts.some((t) => /downloaded its model and is preparing it/.test(t))).toBe(true);
    expect(lm.calls).toContain(`availability ${JSON.stringify(LANGS)}`);
    expect(timers.state.stopped).toBe(1);
  });

  it('says so when Chrome reports no progress for a while, and keeps waiting', async () => {
    const lm = Object.assign(new FakeLanguageModel('downloading'), { hold: true });
    const timers = clock();
    const progress: LoadProgress[] = [];
    const runtime = new PromptApiRuntime(lm, { ...timers.options, stallMs: 1000 });
    const loading = runtime.load(ID, (p) => progress.push(p));
    lm.progress?.({ loaded: 0.51 });
    timers.state.at = 5000;
    await timers.fire();
    expect(progress.at(-1)?.text).toMatch(
      /No progress from Chrome for 5 s.*chrome:\/\/on-device-internals/,
    );
    expect(progress.at(-1)?.fraction).toBe(0.51);
    lm.settle?.resolve(new FakeSession([]));
    await expect(loading).resolves.toBeUndefined();
  });

  it('Cancel aborts Chrome’s create() and the load says it was cancelled', async () => {
    const lm = Object.assign(new FakeLanguageModel('downloading'), { hold: true });
    const cancel = new AbortController();
    const loading = new PromptApiRuntime(lm, clock().options).load(ID, () => {}, cancel.signal);
    cancel.abort();
    await expect(loading).rejects.toThrow('The download was cancelled.');
    expect((lm.creates[0]?.signal as AbortSignal).aborted).toBe(true);
  });

  it('gives Chrome’s exact error, the state and the fix when the click is missing', async () => {
    const lm = new FakeLanguageModel('downloadable');
    lm.failWith = new DOMException('Requires user activation', 'NotAllowedError');
    const error = await new PromptApiRuntime(lm, clock().options)
      .load(ID, () => {})
      .catch((e: unknown) => e);
    expect(String(error)).toContain('NotAllowedError: Requires user activation');
    expect(String(error)).toContain("Chrome's state: downloadable");
    expect(String(error)).toMatch(/press Start again/);
  });

  it('names the requirements when Chrome says the model is unavailable', async () => {
    const lm = new FakeLanguageModel('unavailable');
    lm.failWith = new DOMException('The device is not eligible', 'NotSupportedError');
    const error = await new PromptApiRuntime(lm, clock().options)
      .load(ID, () => {})
      .catch((e: unknown) => e);
    expect(String(error)).toContain('NotSupportedError: The device is not eligible');
    expect(String(error)).toMatch(/22 GB free disk.*4 GB/);
  });

  it('never aborts create() because one poll says unavailable; it shows why and waits', async () => {
    const lm = Object.assign(new FakeLanguageModel('unavailable'), { hold: true });
    const timers = clock();
    const progress: LoadProgress[] = [];
    const loading = new PromptApiRuntime(lm, timers.options).load(ID, (p) => progress.push(p));
    await timers.fire();
    expect((lm.creates[0]?.signal as AbortSignal).aborted).toBe(false);
    expect(progress.at(-1)?.text).toMatch(/22 GB free disk.*state: unavailable/s);
    lm.state = 'downloading';
    lm.settle?.resolve(new FakeSession([]));
    await expect(loading).resolves.toBeUndefined();
  });

  it('gives a plain reason for each state while it waits', async () => {
    const reasons: Record<string, RegExp> = {
      downloadable: /not on this computer.*this click starts the download/,
      downloading: /Chrome is downloading/,
      available: /on this computer.*starting it/,
    };
    for (const [state, reason] of Object.entries(reasons)) {
      const lm = Object.assign(new FakeLanguageModel(state), { hold: true });
      const timers = clock();
      const progress: LoadProgress[] = [];
      const loading = new PromptApiRuntime(lm, timers.options).load(ID, (p) => progress.push(p));
      await timers.fire();
      expect(progress.at(-1)?.text).toMatch(reason);
      lm.settle?.resolve(new FakeSession([]));
      await loading;
    }
  });

  it('says a failed download is a network problem and that Start tries again', async () => {
    const lm = new FakeLanguageModel('downloading');
    lm.failWith = new DOMException('Failed to download', 'NetworkError');
    const error = await new PromptApiRuntime(lm, clock().options)
      .load(ID, () => {})
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/download did not finish.*unmetered.*press Start again/s);
  });

  it('says the language is not supported when Chrome refuses it on a model that is there', async () => {
    const lm = new FakeLanguageModel('available');
    lm.failWith = new DOMException('Unsupported language', 'NotSupportedError');
    const error = await new PromptApiRuntime(lm, clock().options)
      .load(ID, () => {})
      .catch((e: unknown) => e);
    expect(String(error)).toMatch(/does not support this language; use a downloaded model/);
  });

  it('reads the window from the first session: contextWindow, else the old inputQuota', async () => {
    const lm = new FakeLanguageModel('available');
    lm.contextWindow = 9216;
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    expect(runtime.capabilities().contextTokens).toBe(9216);
    const older = new FakeLanguageModel('available');
    older.contextWindow = undefined;
    older.inputQuota = 6144;
    const second = new PromptApiRuntime(older, clock().options);
    await second.load(ID, () => {});
    expect(second.capabilities().contextTokens).toBe(6144);
  });

  it('falls back to 4096 tokens when Chrome gives no window', async () => {
    const lm = new FakeLanguageModel('available');
    lm.contextWindow = undefined;
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    expect(runtime.capabilities().contextTokens).toBe(4096);
  });

  it('never gives create() a topK or temperature (params() is null in Chrome 157)', async () => {
    const lm = new FakeLanguageModel('available', ['{"answer":"x"}']);
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    await runtime.chat({ messages: [{ role: 'user', content: 'Q' }] });
    for (const options of lm.creates) {
      expect(options).not.toHaveProperty('topK');
      expect(options).not.toHaveProperty('temperature');
    }
  });

  it('unload() ends a load that is still waiting for Chrome', async () => {
    const lm = Object.assign(new FakeLanguageModel('downloading'), { hold: true });
    const runtime = new PromptApiRuntime(lm, clock().options);
    const loading = runtime.load(ID, () => {});
    await runtime.unload();
    await expect(loading).rejects.toThrow('The download was cancelled.');
  });

  it('reads the state even when availability() itself fails', async () => {
    const lm = new FakeLanguageModel('downloadable');
    lm.failWith = new Error('boom');
    lm.availability = () => Promise.reject(new Error('no answer'));
    const error = await new PromptApiRuntime(lm, clock().options)
      .load(ID, () => {})
      .catch((e: unknown) => e);
    expect(String(error)).toContain("Chrome's state: unknown (no answer)");
  });
});

describe('PromptApiRuntime chat', () => {
  it('puts the earlier turns in initialPrompts and streams the last user turn', async () => {
    const lm = new FakeLanguageModel('available', ['{"answer"', ': "ok"}']);
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    const tokens: string[] = [];
    const reply = await runtime.chat({
      messages: [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: 'A' },
        { role: 'tool', content: 'R' },
      ],
      onToken: (t) => tokens.push(t),
    });
    expect(reply).toBe('{"answer": "ok"}');
    expect(tokens).toHaveLength(2);
    expect(lm.creates[1]).toMatchObject(LANGS);
    expect(lm.creates[1]?.initialPrompts).toEqual([
      { role: 'system', content: 'S' },
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' },
    ]);
    expect(lm.sessions[1]?.prompts[0]?.input).toBe('R');
    expect(lm.sessions[1]?.destroyed).toBe(true);
  });

  it('passes a real AbortSignal through to Chrome', async () => {
    const lm = new FakeLanguageModel('available', ['x']);
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    const signal = new AbortController().signal;
    await runtime.chat({ messages: [{ role: 'user', content: 'Q' }], signal });
    const given = lm.sessions[1]?.prompts[0]?.options as { signal: AbortSignal };
    expect(given.signal).toBeInstanceOf(AbortSignal);
    expect(lm.creates[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(given.signal.aborted).toBe(false);
    const stop = new AbortController();
    await runtime.chat({ messages: [{ role: 'user', content: 'Q' }], signal: stop.signal });
    const later = lm.sessions[2]?.prompts[0]?.options as { signal: AbortSignal };
    stop.abort();
    expect(later.signal.aborted).toBe(true);
  });

  it('refuses to chat before load, and with no user turn at the end', async () => {
    const runtime = new PromptApiRuntime(new FakeLanguageModel('available'), clock().options);
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/not loaded/);
    await runtime.load(ID, () => {});
    await expect(runtime.chat({ messages: [{ role: 'assistant', content: 'A' }] })).rejects.toThrow(
      /user turn/,
    );
    await runtime.unload();
    await expect(runtime.chat({ messages: [] })).rejects.toThrow(/not loaded/);
  });

  it('reports a constrained reply, a compact prompt, and its window and reply room', async () => {
    const lm = new FakeLanguageModel('available');
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    expect(runtime.capabilities()).toEqual({
      nativeToolCalls: false,
      jsonConstraint: true,
      contextTokens: 9216,
      compactPrompt: true,
      replyTokens: 1024,
    });
  });

  it('keeps a quarter of a small window for the reply', async () => {
    const lm = new FakeLanguageModel('available');
    lm.contextWindow = 1024;
    const runtime = new PromptApiRuntime(lm, clock().options);
    await runtime.load(ID, () => {});
    expect(runtime.capabilities()).toMatchObject({ contextTokens: 1024, replyTokens: 256 });
  });

  it('before it is loaded it reports the 4096-token default', () => {
    expect(new PromptApiRuntime(undefined).capabilities()).toEqual({
      nativeToolCalls: false,
      jsonConstraint: true,
      contextTokens: 4096,
      compactPrompt: true,
      replyTokens: 1024,
    });
  });
});
