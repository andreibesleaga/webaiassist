// SPDX-License-Identifier: Apache-2.0
// SiteGrants adapter on chrome.storage.session: the sites the user allowed in this
// browser session. The browser clears this storage area when it restarts.
import type { SiteGrants } from '../core/ports/site-grants';
import type { StorageAreaLike } from './settings';

const KEY = 'allowedSites';

export class SessionSiteGrants implements SiteGrants {
  constructor(private readonly area: StorageAreaLike) {}

  async has(origin: string): Promise<boolean> {
    return (await this.read()).includes(origin);
  }

  async add(origin: string): Promise<void> {
    const sites = await this.read();
    if (!sites.includes(origin)) await this.area.set({ [KEY]: [...sites, origin] });
  }

  async remove(origin: string): Promise<void> {
    const sites = await this.read();
    await this.area.set({ [KEY]: sites.filter((site) => site !== origin) });
  }

  async clear(): Promise<void> {
    await this.area.remove(KEY);
  }

  private async read(): Promise<string[]> {
    const value = (await this.area.get(KEY))[KEY];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }
}
