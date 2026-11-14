// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { SiteGrants } from '../../src/core/ports/site-grants';
import { siteAllowed } from '../../src/core/site-consent';

class MemoryGrants implements SiteGrants {
  readonly origins = new Set<string>();
  has(origin: string): Promise<boolean> {
    return Promise.resolve(this.origins.has(origin));
  }
  add(origin: string): Promise<void> {
    this.origins.add(origin);
    return Promise.resolve();
  }
}

const site = { origin: 'https://node.example', toolCount: 10 };

describe('siteAllowed', () => {
  it('asks on first use and remembers an Allow', async () => {
    const grants = new MemoryGrants();
    const asked: unknown[] = [];
    const ask = (request: unknown) => {
      asked.push(request);
      return Promise.resolve(true);
    };
    expect(await siteAllowed(grants, ask, site)).toBe(true);
    expect(await siteAllowed(grants, ask, site)).toBe(true);
    expect(asked).toEqual([site]);
    expect([...grants.origins]).toEqual(['https://node.example']);
  });

  it('asks again next time after a Deny and stores nothing', async () => {
    const grants = new MemoryGrants();
    let count = 0;
    const ask = () => {
      count += 1;
      return Promise.resolve(false);
    };
    expect(await siteAllowed(grants, ask, site)).toBe(false);
    expect(await siteAllowed(grants, ask, site)).toBe(false);
    expect(count).toBe(2);
    expect(grants.origins.size).toBe(0);
  });
});
