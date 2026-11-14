// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from 'vitest';
import { PAGE_TEXT_CAP, readPageText, type ScriptingLike } from '../../src/adapters/page-reader';

function scriptingReturning(result: unknown, calls: unknown[] = []): ScriptingLike {
  return {
    executeScript: (injection) => {
      calls.push(injection);
      return Promise.resolve([{ result }]);
    },
  };
}

const globals = globalThis as Record<string, unknown>;

afterEach(() => {
  delete globals.location;
  delete globals.document;
});

describe('readPageText', () => {
  it('runs a self-contained function in the tab and returns origin, title and text', async () => {
    const calls: { target: { tabId: number }; func: () => unknown }[] = [];
    const page = { origin: 'https://a.example', title: 'A', text: 'Hello' };
    expect(await readPageText(scriptingReturning(page, calls), 12)).toEqual(page);
    expect(calls[0]?.target).toEqual({ tabId: 12 });
    globals.location = { origin: 'https://b.example' };
    globals.document = { title: 'B', body: { innerText: 'Body text' } };
    expect(calls[0]?.func()).toEqual({
      origin: 'https://b.example',
      title: 'B',
      text: 'Body text',
    });
    globals.document = { title: 'C', body: null };
    expect(calls[0]?.func()).toEqual({ origin: 'https://b.example', title: 'C', text: '' });
  });

  it('caps the text', async () => {
    const page = { origin: 'https://a.example', title: 'A', text: 'x'.repeat(PAGE_TEXT_CAP + 5) };
    expect((await readPageText(scriptingReturning(page), 1)).text).toHaveLength(PAGE_TEXT_CAP);
  });

  it('says how to give access when the script cannot run', async () => {
    const scripting: ScriptingLike = {
      executeScript: () => Promise.reject(new Error('Cannot access contents of the page.')),
    };
    await expect(readPageText(scripting, 1)).rejects.toThrow(/not allowed on this page yet/);
    const store: ScriptingLike = {
      executeScript: () => Promise.reject(new Error('The extensions gallery cannot be scripted.')),
    };
    await expect(readPageText(store, 1)).rejects.toThrow(/cannot run on this page/);
  });

  it('refuses a result of the wrong shape', async () => {
    for (const result of [undefined, 'text', { origin: 'x', title: 1, text: '' }]) {
      await expect(readPageText(scriptingReturning(result), 1)).rejects.toThrow(
        /could not read the text/,
      );
    }
    const empty: ScriptingLike = { executeScript: () => Promise.resolve([]) };
    await expect(readPageText(empty, 1)).rejects.toThrow(/could not read the text/);
  });
});
