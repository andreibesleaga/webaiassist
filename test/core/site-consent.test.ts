// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { SiteGrants } from '../../src/core/ports/site-grants';
import { siteAllowed, siteGate } from '../../src/core/site-consent';

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

describe('siteGate: the question is asked when a tool is first about to be used', () => {
  const setup = (answerYes: boolean) => {
    const grants = new MemoryGrants();
    const log: string[] = [];
    const gate = siteGate(
      grants,
      () => (log.push('asked'), Promise.resolve(answerYes)),
      site,
      () => log.push('denied'),
    );
    return { grants, log, gate };
  };

  it('asks nothing until the gate is used', () => {
    const { log, grants } = setup(true);
    expect(log).toEqual([]);
    expect(grants.origins.size).toBe(0);
  });

  it('asks once on the first use and then lets every call through', async () => {
    const { gate, log } = setup(true);
    expect(await gate()).toBe(true);
    expect(await gate()).toBe(true);
    expect(log).toEqual(['asked']);
  });

  it('after a Deny refuses for the rest of the run without asking again, and says so once', async () => {
    const { gate, log, grants } = setup(false);
    expect(await gate()).toBe(false);
    expect(await gate()).toBe(false);
    expect(log).toEqual(['asked', 'denied']);
    expect(grants.origins.size).toBe(0);
  });
});
