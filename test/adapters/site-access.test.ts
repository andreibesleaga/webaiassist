// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { allowSite, type SiteAccessDeps } from '../../src/adapters/site-access';

function deps(granted = true, hostRequests = true) {
  const requested: string[][] = [];
  const hostAccess: { tabId: number }[] = [];
  const d: SiteAccessDeps = {
    allow: () => Promise.resolve(),
    request: (origins) => {
      requested.push(origins);
      return Promise.resolve(granted);
    },
    ...(hostRequests
      ? {
          addHostAccessRequest: (request: { tabId: number }) => {
            hostAccess.push(request);
            return Promise.resolve();
          },
        }
      : {}),
  };
  return { d, requested, hostAccess };
}

describe('allowSite', () => {
  it('asks the browser for the one known site, first thing in the click', async () => {
    const { d, requested } = deps();
    const pending = allowSite(d, { tabId: 4, origin: 'https://agenticsystemcore.com' });
    expect(requested).toEqual([['https://agenticsystemcore.com/*']]);
    expect(await pending).toBe('granted');
    const refused = deps(false);
    expect(await allowSite(refused.d, { tabId: 4, origin: 'http://localhost:8080' })).toBe(
      'denied',
    );
    expect(refused.requested).toEqual([['http://localhost:8080/*']]);
  });

  it('refuses a site that is not a plain http(s) origin', () => {
    const { d, requested } = deps();
    expect(() => allowSite(d, { tabId: 4, origin: 'chrome://settings' })).toThrow(/http/);
    expect(requested).toEqual([]);
  });

  it('asks Chrome to show its own site-access request when the site is not known yet', async () => {
    const { d, requested, hostAccess } = deps();
    expect(await allowSite(d, { tabId: 4 })).toBe('requested');
    expect(hostAccess).toEqual([{ tabId: 4 }]);
    expect(requested).toEqual([]);
  });

  it('points to the toolbar button on a browser without site-access requests', async () => {
    const { d } = deps(true, false);
    expect(await allowSite(d, { tabId: 4 })).toBe('toolbar');
  });
});
