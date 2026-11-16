// SPDX-License-Identifier: Apache-2.0
// The user's allowed sites: a stored list, separate from Chrome's host permissions.
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SITES_KEY,
  httpOrigin,
  isSiteAllowed,
  patternCovers,
  StoredAllowedSites,
} from '../../src/adapters/allowed-sites';
import type { StorageAreaLike } from '../../src/adapters/settings';
import { InMemoryAllowedSites } from '../../src/fakes/in-memory-allowed-sites';

class MemoryArea implements StorageAreaLike {
  readonly data: Record<string, unknown> = {};
  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve(key in this.data ? { [key]: this.data[key] } : {});
  }
  set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, items);
    return Promise.resolve();
  }
  remove(key: string): Promise<void> {
    delete this.data[key];
    return Promise.resolve();
  }
}

describe('StoredAllowedSites', () => {
  it('adds, finds, removes and clears origins', async () => {
    const sites = new StoredAllowedSites(new MemoryArea());
    await sites.add('https://a.example');
    await sites.add('https://a.example');
    await sites.add('https://b.example');
    expect(await sites.has('https://a.example')).toBe(true);
    await sites.remove('https://a.example');
    expect(await sites.has('https://a.example')).toBe(false);
    expect(await sites.has('https://b.example')).toBe(true);
    await sites.clear();
    expect(await sites.has('https://b.example')).toBe(false);
  });

  it('reads a foreign stored value as an empty list', async () => {
    const area = new MemoryArea();
    area.data[ALLOWED_SITES_KEY] = { not: 'a list' };
    expect(await new StoredAllowedSites(area).has('https://a.example')).toBe(false);
  });

  it('behaves like its in-memory fake', async () => {
    for (const sites of [new StoredAllowedSites(new MemoryArea()), new InMemoryAllowedSites()]) {
      await sites.add('http://localhost:3000');
      expect(await sites.has('http://localhost:3000')).toBe(true);
      expect(await sites.has('http://localhost')).toBe(false);
    }
  });
});

describe('isSiteAllowed', () => {
  it('is false for a site that only has a host permission (the endpoint case)', async () => {
    expect(await isSiteAllowed(new InMemoryAllowedSites(), [], 'http://localhost:11434')).toBe(
      false,
    );
  });

  it('is true for a listed site', async () => {
    const listed = new InMemoryAllowedSites();
    await listed.add('https://a.example');
    expect(await isSiteAllowed(listed, [], 'https://a.example')).toBe(true);
  });

  it('is true for a host the manifest itself requires (the test builds)', async () => {
    const none = new InMemoryAllowedSites();
    const patterns = ['http://127.0.0.1/*'];
    expect(await isSiteAllowed(none, patterns, 'http://127.0.0.1:8123')).toBe(true);
    expect(await isSiteAllowed(none, patterns, 'http://127.0.0.3:8123')).toBe(false);
  });
});

describe('helpers', () => {
  it('reads the origin of an http(s) address only', () => {
    expect(httpOrigin('https://a.example/x?y')).toBe('https://a.example');
    expect(httpOrigin('chrome://settings')).toBeUndefined();
    expect(httpOrigin(undefined)).toBeUndefined();
  });

  it('matches a pattern by scheme and host, ignoring the port like Chrome', () => {
    expect(patternCovers('http://localhost/*', 'http://localhost:11434')).toBe(true);
    expect(patternCovers('http://localhost/*', 'https://localhost')).toBe(false);
    expect(patternCovers('https://*/*', 'https://a.example')).toBe(true);
    expect(patternCovers('not a pattern', 'https://a.example')).toBe(false);
  });
});
