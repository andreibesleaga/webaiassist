// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { compatScriptId } from '../../src/adapters/compat-mode';
import { forgetAllSites, forgetSite } from '../../src/adapters/forget-site';
import { InMemoryMemory } from '../../src/fakes/in-memory-memory';

const ORIGIN = 'https://node.example';

function fakes() {
  const memory = new InMemoryMemory();
  const calls: string[] = [];
  const allowed = new Set([ORIGIN, 'https://other.example']);
  return {
    memory,
    calls,
    allowed,
    deps: {
      memory,
      grants: {
        remove: (origin: string) => {
          allowed.delete(origin);
          return Promise.resolve();
        },
      },
      compat: {
        unregister: (ids: string[]) => {
          calls.push(`unregister ${ids.join(',')}`);
          return Promise.resolve();
        },
        removeOrigins: (origins: string[]) => {
          calls.push(`remove ${origins.join(',')}`);
          return Promise.resolve(true);
        },
      },
    },
  };
}

describe('forgetSite', () => {
  it("drops the site's memory, its session allowance, compat mode and its host access", async () => {
    const f = fakes();
    await f.memory.recordToolResult(ORIGIN, 'search', true, '2026-01-01T00:00:00Z');
    await f.memory.saveChat(ORIGIN, [{ role: 'user', content: 'hi' }]);
    await f.memory.saveChat('https://other.example', [{ role: 'user', content: 'keep' }]);
    await forgetSite(f.deps, ORIGIN);
    expect(await f.memory.history(ORIGIN)).toEqual([]);
    expect(await f.memory.loadChat(ORIGIN)).toEqual([]);
    expect(await f.memory.loadChat('https://other.example')).toHaveLength(1);
    expect([...f.allowed]).toEqual(['https://other.example']);
    expect(f.calls).toEqual([`unregister ${compatScriptId(ORIGIN)}`, `remove ${ORIGIN}/*`]);
  });

  it('refuses a value that is not an http(s) origin, and changes nothing', async () => {
    const f = fakes();
    await expect(forgetSite(f.deps, 'chrome://settings')).rejects.toThrow(/http/);
    expect(f.calls).toEqual([]);
    expect(f.allowed.size).toBe(2);
  });
});

describe('forgetAllSites', () => {
  function all(granted: string[], keep: string[] = []) {
    const calls: string[] = [];
    const memory = new InMemoryMemory();
    return {
      memory,
      calls,
      deps: {
        memory,
        grants: {
          clear: () => {
            calls.push('clear grants');
            return Promise.resolve();
          },
        },
        compat: {
          unregisterAll: () => {
            calls.push('unregister all');
            return Promise.resolve();
          },
          grantedOrigins: () => Promise.resolve(granted),
          removeOrigins: (origins: string[]) => {
            calls.push(`remove ${origins.join(',')}`);
            return Promise.resolve(true);
          },
        },
        keep,
      },
    };
  }

  it('clears every chat, every allowance, every compat script and every granted site', async () => {
    const f = all(['https://a.example/*', 'https://b.example/*']);
    await f.memory.saveChat('https://a.example', [{ role: 'user', content: 'x' }]);
    await f.memory.saveChat('https://b.example', [{ role: 'user', content: 'y' }]);
    await forgetAllSites(f.deps);
    expect(await f.memory.loadChat('https://a.example')).toEqual([]);
    expect(await f.memory.loadChat('https://b.example')).toEqual([]);
    expect(f.calls).toEqual([
      'clear grants',
      'unregister all',
      'remove https://a.example/*,https://b.example/*',
    ]);
  });

  it('keeps the address of the chat endpoint, which is not a site the user allowed', async () => {
    const f = all(['https://a.example/*', 'http://localhost/*'], ['http://localhost/*']);
    await forgetAllSites(f.deps);
    expect(f.calls.at(-1)).toBe('remove https://a.example/*');
  });

  it('removes no access when there is none to remove', async () => {
    const f = all([]);
    await forgetAllSites(f.deps);
    expect(f.calls).toEqual(['clear grants', 'unregister all']);
  });
});
