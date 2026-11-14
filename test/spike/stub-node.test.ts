// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { registerStubTools, stubResult } from '../../src/spike/stub-node';
import { AGSC_TOOLS } from '../helpers';

interface Registered {
  tool: {
    name: string;
    execute: (args: object) => unknown;
    inputSchema?: object;
    annotations?: object;
  };
  options?: { signal?: AbortSignal };
}

describe('registerStubTools', () => {
  it('registers the ten node tools with their schemas, annotations and the signal', async () => {
    const seen: Registered[] = [];
    const ctx = {
      registerTool: (tool: object, options?: object) =>
        void seen.push({ tool, options } as Registered),
    };
    const signal = new AbortController().signal;
    const outcome = await registerStubTools(ctx, AGSC_TOOLS, signal);
    expect(outcome.registered).toHaveLength(10);
    expect(outcome.rejected).toEqual([]);
    expect(seen[0]?.tool.inputSchema).toEqual(AGSC_TOOLS[0]?.inputSchema);
    expect(seen[0]?.tool.annotations).toEqual(AGSC_TOOLS[0]?.annotations);
    expect(seen[0]?.options?.signal).toBe(signal);
  });

  it('gives each tool an execute that returns the node envelope shape', async () => {
    const seen: Registered[] = [];
    const ctx = { registerTool: (tool: object) => void seen.push({ tool } as Registered) };
    await registerStubTools(ctx, AGSC_TOOLS.slice(0, 1), new AbortController().signal);
    expect(await seen[0]?.tool.execute({ question: 'q' })).toEqual(
      stubResult('ask', { question: 'q' }),
    );
  });

  it('records tools the page refuses, by a throw or a rejected promise', async () => {
    let n = 0;
    const ctx = {
      registerTool: () => {
        n += 1;
        if (n === 1) throw Object.assign(new Error('dup'), { name: 'InvalidStateError' });
        return n === 2 ? Promise.reject(new Error('later')) : Promise.resolve();
      },
    };
    const outcome = await registerStubTools(
      ctx,
      AGSC_TOOLS.slice(0, 3),
      new AbortController().signal,
    );
    expect(outcome.rejected).toEqual([
      { name: 'ask', error: 'InvalidStateError: dup' },
      { name: 'brief', error: 'Error: later' },
    ]);
    expect(outcome.registered).toEqual(['check']);
  });

  it('registers nothing when registerTool is missing', async () => {
    const outcome = await registerStubTools({}, AGSC_TOOLS, new AbortController().signal);
    expect(outcome).toEqual({
      registered: [],
      rejected: [{ name: '*', error: 'registerTool() is not available' }],
    });
  });
});

describe('stubResult', () => {
  it('is marked untrusted like a node result', () => {
    expect(stubResult('read', { slug: 'a' })).toMatchObject({
      source: 'read',
      trust: 'untrusted',
      type: 'stub',
    });
  });
});
