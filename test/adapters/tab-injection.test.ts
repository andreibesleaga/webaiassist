// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { bridgeInjector } from '../../src/adapters/tab-injection';

function recorder(fail?: Error) {
  const runs: string[] = [];
  const pending: (() => void)[] = [];
  const run = (tabId: number, file: string, world: string): Promise<void> => {
    runs.push(`${tabId}:${file}:${world}`);
    if (fail) return Promise.reject(fail);
    return new Promise((resolve) => pending.push(resolve));
  };
  const finish = async (): Promise<void> => {
    while (pending.length > 0) {
      pending.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  return { runs, run, finish };
}

describe('bridgeInjector', () => {
  it('adds the MAIN-world script before the isolated relay', async () => {
    const r = recorder();
    const inject = bridgeInjector(r.run);
    const done = inject(4);
    await r.finish();
    await done;
    expect(r.runs).toEqual(['4:content-main.js:MAIN', '4:content-isolated.js:ISOLATED']);
  });

  it('runs one injection per tab at a time and shares it between callers', async () => {
    const r = recorder();
    const inject = bridgeInjector(r.run);
    const first = inject(4);
    const second = inject(4);
    const other = inject(9);
    await r.finish();
    await Promise.all([first, second, other]);
    expect(r.runs.filter((x) => x.startsWith('4:'))).toHaveLength(2);
    expect(r.runs.filter((x) => x.startsWith('9:'))).toHaveLength(2);
    const again = inject(4);
    await r.finish();
    await again;
    expect(r.runs.filter((x) => x.startsWith('4:'))).toHaveLength(4);
  });

  it('gives the refusal to every caller and tries again on the next request', async () => {
    const r = recorder(new Error('Cannot access contents of the page.'));
    const inject = bridgeInjector(r.run);
    await expect(Promise.all([inject(4), inject(4)])).rejects.toThrow(/Cannot access/);
    await expect(inject(4)).rejects.toThrow(/Cannot access/);
    expect(r.runs).toEqual(['4:content-main.js:MAIN', '4:content-main.js:MAIN']);
  });
});
