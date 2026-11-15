// SPDX-License-Identifier: Apache-2.0
// "Forget all sites" with the real browser: chats and tool counts in IndexedDB, the session's
// "use the tools of this site" answers, the compat scripts, and every host access the user granted
// (except the chat endpoint's, and except hosts the manifest itself requires, which Chrome never
// lets an extension remove).
import { COMPAT_ID_PREFIX } from '../../adapters/compat-mode';
import { forgetAllSites } from '../../adapters/forget-site';
import { openIndexedDbMemory } from '../../adapters/indexeddb-memory';
import { SessionSiteGrants } from '../../adapters/session-site-grants';
import { loadSettings } from '../../adapters/settings';
import { withActivity } from '../../adapters/forget-activity';
import { lazyActivityLog } from './activity-log';
import { endpointAccess } from '../../ui/options-form';

async function endpointPattern(): Promise<string[]> {
  const { endpoint } = await loadSettings(chrome.storage.local);
  if (endpoint.model === '') return [];
  try {
    return [endpointAccess(endpoint.url).pattern];
  } catch {
    return [];
  }
}

async function grantedOrigins(): Promise<string[]> {
  const manifest = chrome.runtime.getManifest() as { host_permissions?: string[] };
  const required = new Set<string>(manifest.host_permissions ?? []);
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter((origin) => !required.has(origin));
}

async function unregisterAll(): Promise<void> {
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const ids = scripts.map((s) => s.id).filter((id) => id.startsWith(COMPAT_ID_PREFIX));
  if (ids.length > 0) await chrome.scripting.unregisterContentScripts({ ids });
}

export async function forgetAll(): Promise<void> {
  await forgetAllSites({
    memory: withActivity(
      { clear: async (origin) => (await openIndexedDbMemory()).clear(origin) },
      lazyActivityLog,
    ),
    grants: new SessionSiteGrants(chrome.storage.session),
    compat: {
      unregisterAll,
      grantedOrigins,
      removeOrigins: (origins) => chrome.permissions.remove({ origins }),
    },
    keep: await endpointPattern(),
  });
}
