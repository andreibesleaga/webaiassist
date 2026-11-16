// SPDX-License-Identifier: Apache-2.0
// AllowedSites adapter on chrome.storage.local: the origins the user explicitly allowed (the
// Allow button, compat mode, or the toolbar button on that page). It is separate from Chrome's
// host permissions, which the chat endpoint also uses. Only extension pages read it
// (storage.local is restricted to trusted contexts).
import type { AllowedSites } from '../core/ports/allowed-sites';
import type { StorageAreaLike } from './settings';

export const ALLOWED_SITES_KEY = 'allowedOrigins';
const MAX_SITES = 500;

export class StoredAllowedSites implements AllowedSites {
  constructor(private readonly area: StorageAreaLike) {}

  async has(origin: string): Promise<boolean> {
    return (await this.read()).includes(origin);
  }

  async add(origin: string): Promise<void> {
    const sites = await this.read();
    if (sites.includes(origin)) return;
    await this.area.set({ [ALLOWED_SITES_KEY]: [...sites, origin].slice(-MAX_SITES) });
  }

  async remove(origin: string): Promise<void> {
    const sites = await this.read();
    await this.area.set({ [ALLOWED_SITES_KEY]: sites.filter((site) => site !== origin) });
  }

  async clear(): Promise<void> {
    await this.area.remove(ALLOWED_SITES_KEY);
  }

  private async read(): Promise<string[]> {
    const value = (await this.area.get(ALLOWED_SITES_KEY))[ALLOWED_SITES_KEY];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }
}

/** The origin of an http(s) address, or undefined for anything else. */
export function httpOrigin(url: string | undefined): string | undefined {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

/** True when a match pattern (`scheme://host/*`, host a name or `*`) covers the origin's scheme and host. */
export function patternCovers(pattern: string, origin: string): boolean {
  const match = /^(https?|\*):\/\/([^/]+)\/\*$/.exec(pattern);
  const site = httpOrigin(origin);
  if (!match || site === undefined) return false;
  const url = new URL(site);
  const schemeOk = match[1] === '*' || `${match[1]}:` === url.protocol;
  return schemeOk && (match[2] === '*' || match[2] === url.hostname);
}

/**
 * Is this origin allowed: the user listed it, or the manifest itself requires access to it (the
 * test builds list 127.0.0.1 in host_permissions; the release build lists none). A host the user
 * granted for another reason, such as the chat endpoint, is not enough.
 */
export async function isSiteAllowed(
  sites: Pick<AllowedSites, 'has'>,
  requiredPatterns: readonly string[],
  origin: string,
): Promise<boolean> {
  if (requiredPatterns.some((pattern) => patternCovers(pattern, origin))) return true;
  return sites.has(origin);
}
