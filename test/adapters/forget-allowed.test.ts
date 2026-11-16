// SPDX-License-Identifier: Apache-2.0
// Forget removes a site from the allowed list even when Chrome refuses to take its host
// permission back; the Allow paths put the site on the list.
import { describe, expect, it } from 'vitest';
import { onActionClick, type ActionDeps } from '../../src/adapters/action-click';
import { enableCompat } from '../../src/adapters/compat-mode';
import { forgetSite } from '../../src/adapters/forget-site';
import { allowSite } from '../../src/adapters/site-access';
import { InMemoryAllowedSites } from '../../src/fakes/in-memory-allowed-sites';
import { InMemoryMemory } from '../../src/fakes/in-memory-memory';

const ORIGIN = 'https://node.example';

describe('forgetSite and the allowed list', () => {
  function setup(removeOrigins: () => Promise<boolean>) {
    const allowed = new InMemoryAllowedSites();
    const memory = new InMemoryMemory();
    const deps = {
      memory,
      grants: { remove: () => Promise.resolve() },
      allowed,
      compat: { unregister: () => Promise.resolve(), removeOrigins },
    };
    return { allowed, memory, deps };
  }

  it('removes the site from the allowed list', async () => {
    const f = setup(() => Promise.resolve(true));
    await f.allowed.add(ORIGIN);
    await forgetSite(f.deps, ORIGIN);
    expect(await f.allowed.has(ORIGIN)).toBe(false);
  });

  it('still clears everything else when removing the host permission fails', async () => {
    const f = setup(() => Promise.reject(new Error('You cannot remove required permissions.')));
    await f.allowed.add(ORIGIN);
    await f.memory.saveChat(ORIGIN, [{ role: 'user', content: 'x' }]);
    await expect(forgetSite(f.deps, ORIGIN)).resolves.toBeUndefined();
    expect(await f.allowed.has(ORIGIN)).toBe(false);
    expect(await f.memory.loadChat(ORIGIN)).toEqual([]);
  });
});

describe('what puts a site on the allowed list', () => {
  it('Allow, once the browser granted the site', async () => {
    const allowed: string[] = [];
    const deps = {
      request: () => Promise.resolve(true),
      allow: (origin: string) => Promise.resolve(void allowed.push(origin)),
    };
    expect(await allowSite(deps, { tabId: 1, origin: ORIGIN })).toBe('granted');
    expect(allowed).toEqual([ORIGIN]);
  });

  it('Allow, not when the user refuses', async () => {
    const allowed: string[] = [];
    const deps = {
      request: () => Promise.resolve(false),
      allow: (origin: string) => Promise.resolve(void allowed.push(origin)),
    };
    expect(await allowSite(deps, { tabId: 1, origin: ORIGIN })).toBe('denied');
    expect(allowed).toEqual([]);
  });

  it('compat mode, once the browser granted the site', async () => {
    const allowed: string[] = [];
    const deps = {
      request: () => Promise.resolve(true),
      allow: (origin: string) => Promise.resolve(void allowed.push(origin)),
      isRegistered: () => Promise.resolve(false),
      register: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };
    await enableCompat(deps, { tabId: 1, origin: ORIGIN });
    expect(allowed).toEqual([ORIGIN]);
  });

  it('the toolbar click, for the origin of the page it was made on', async () => {
    const allowed: (string | undefined)[] = [];
    const deps: ActionDeps = {
      openPanel: () => Promise.resolve(),
      inject: () => Promise.resolve(),
      allow: (url) => Promise.resolve(void allowed.push(url)),
      notifyPanel: () => Promise.resolve(),
      warn: () => undefined,
    };
    await onActionClick(deps, { id: 3, windowId: 1, url: `${ORIGIN}/page` });
    expect(allowed).toEqual([`${ORIGIN}/page`]);
  });
});
