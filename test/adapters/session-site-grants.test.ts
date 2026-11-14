// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { SessionSiteGrants } from '../../src/adapters/session-site-grants';
import type { StorageAreaLike } from '../../src/adapters/settings';

class MemoryArea implements StorageAreaLike {
  data: Record<string, unknown> = {};
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

describe('SessionSiteGrants (chrome.storage.session)', () => {
  it('stores allowed origins under one key and reads them back', async () => {
    const area = new MemoryArea();
    const grants = new SessionSiteGrants(area);
    expect(await grants.has('https://a.example')).toBe(false);
    await grants.add('https://a.example');
    await grants.add('https://a.example');
    await grants.add('https://b.example');
    expect(area.data.allowedSites).toEqual(['https://a.example', 'https://b.example']);
    expect(await new SessionSiteGrants(area).has('https://b.example')).toBe(true);
  });

  it('forgets one site, and ignores a stored value that is not a list of strings', async () => {
    const area = new MemoryArea();
    const grants = new SessionSiteGrants(area);
    await grants.add('https://a.example');
    await grants.remove('https://a.example');
    expect(await grants.has('https://a.example')).toBe(false);
    area.data.allowedSites = 'https://a.example';
    expect(await grants.has('https://a.example')).toBe(false);
    area.data.allowedSites = [1, 'https://c.example'];
    expect(await grants.has('https://c.example')).toBe(true);
  });

  it('forgets every site at once', async () => {
    const area = new MemoryArea();
    const grants = new SessionSiteGrants(area);
    await grants.add('https://a.example');
    await grants.add('https://b.example');
    await grants.clear();
    expect(await grants.has('https://a.example')).toBe(false);
    expect(area.data.allowedSites).toBeUndefined();
  });
});
