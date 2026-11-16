// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  compatScriptId,
  enableCompat,
  forgetCompat,
  type CompatDeps,
} from '../../src/adapters/compat-mode';

class FakeCompat implements CompatDeps {
  readonly log: string[] = [];
  readonly registered: unknown[] = [];
  constructor(
    private readonly grant: boolean,
    private readonly existing: string[] = [],
  ) {}
  request(origins: string[]): Promise<boolean> {
    this.log.push(`request ${origins.join(',')}`);
    return Promise.resolve(this.grant);
  }
  allow(origin: string): Promise<void> {
    void origin;
    return Promise.resolve();
  }
  isRegistered(id: string): Promise<boolean> {
    this.log.push(`check ${id}`);
    return Promise.resolve(this.existing.includes(id));
  }
  register(script: Parameters<CompatDeps['register']>[0]): Promise<void> {
    this.log.push(`register ${script.id}`);
    this.registered.push(script);
    return Promise.resolve();
  }
  reload(tabId: number): Promise<void> {
    this.log.push(`reload ${tabId}`);
    return Promise.resolve();
  }
}

const page = { tabId: 4, origin: 'https://shop.example' };

describe('compat mode', () => {
  it('names the script after the origin', () => {
    expect(compatScriptId('https://shop.example:8443')).toBe('compat-https___shop_example_8443');
  });

  it('asks for the site first, registers the polyfill at document start, then reloads', async () => {
    const deps = new FakeCompat(true);
    expect(await enableCompat(deps, page)).toBe('enabled');
    expect(deps.log).toEqual([
      'request https://shop.example/*',
      'check compat-https___shop_example',
      'register compat-https___shop_example',
      'reload 4',
    ]);
    expect(deps.registered).toEqual([
      {
        id: 'compat-https___shop_example',
        matches: ['https://shop.example/*'],
        js: ['webmcp-polyfill.js'],
        world: 'MAIN',
        runAt: 'document_start',
        persistAcrossSessions: false,
      },
    ]);
  });

  it('does nothing more when the user refuses the site', async () => {
    const deps = new FakeCompat(false);
    expect(await enableCompat(deps, page)).toBe('denied');
    expect(deps.log).toEqual(['request https://shop.example/*']);
  });

  it('does not register twice or reload when it is already on', async () => {
    const deps = new FakeCompat(true, ['compat-https___shop_example']);
    expect(await enableCompat(deps, page)).toBe('already');
    expect(deps.log.some((l) => l.startsWith('register') || l.startsWith('reload'))).toBe(false);
  });

  it('refuses an origin that is not http(s)', async () => {
    await expect(
      enableCompat(new FakeCompat(true), { tabId: 1, origin: 'file://' }),
    ).rejects.toThrow(/http/);
    await expect(
      enableCompat(new FakeCompat(true), { tabId: 1, origin: 'https://a.example/path' }),
    ).rejects.toThrow(/http/);
  });

  it('forgets a site: removes the script and the site access', async () => {
    const log: string[] = [];
    await forgetCompat(
      {
        unregister: (ids) => {
          log.push(`unregister ${ids.join(',')}`);
          return Promise.resolve();
        },
        removeOrigins: (origins) => {
          log.push(`remove ${origins.join(',')}`);
          return Promise.resolve(true);
        },
      },
      'https://shop.example',
    );
    expect(log).toEqual([
      'unregister compat-https___shop_example',
      'remove https://shop.example/*',
    ]);
  });

  it('still removes the site access when no script was registered', async () => {
    const log: string[] = [];
    await forgetCompat(
      {
        unregister: () => Promise.reject(new Error('Nonexistent script ID')),
        removeOrigins: (origins) => {
          log.push(`remove ${origins.join(',')}`);
          return Promise.resolve(true);
        },
      },
      'https://shop.example',
    );
    expect(log).toEqual(['remove https://shop.example/*']);
  });
});

describe('compat mode: one exact site per grant', () => {
  const deps = () => ({
    allow: () => Promise.resolve(),
    request: () => Promise.resolve(true),
    register: () => Promise.resolve(),
    isRegistered: () => Promise.resolve(false),
    reload: () => Promise.resolve(),
  });

  it.each(['https://*.example', 'https://user@a.example', 'https://a.example/', 'https://a b'])(
    'refuses %s',
    async (origin) => {
      await expect(enableCompat(deps(), { tabId: 1, origin })).rejects.toThrow();
    },
  );

  it.each(['https://a.example', 'http://localhost:8080', 'https://10.0.0.2:8443'])(
    'accepts %s',
    async (origin) => {
      expect(await enableCompat(deps(), { tabId: 1, origin })).toBe('enabled');
    },
  );
});
