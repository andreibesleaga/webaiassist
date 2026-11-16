// SPDX-License-Identifier: Apache-2.0
// The user's allowed sites with the real browser (src/adapters/allowed-sites.ts): the list in
// chrome.storage.local, plus the hosts the manifest itself requires (only the test builds list any).
import { isSiteAllowed, StoredAllowedSites } from '../../adapters/allowed-sites';

export const allowedSites = new StoredAllowedSites(chrome.storage.local);

/** Whether the user allowed this origin as a site; a host permission alone is not enough. */
export function siteIsAllowed(origin: string): Promise<boolean> {
  const manifest = chrome.runtime.getManifest() as { host_permissions?: string[] };
  return isSiteAllowed(allowedSites, manifest.host_permissions ?? [], origin);
}
