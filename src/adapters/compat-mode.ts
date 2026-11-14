// SPDX-License-Identifier: Apache-2.0
// Compat mode, on the user's click only: for a site whose page registers WebMCP tools only
// when `document.modelContext` exists, the extension adds the W3C WebMCP polyfill
// (@w3c/webmcp-polyfill) to that site at document start, in the MAIN world, before the
// page's own scripts, then reloads the tab. It needs the site's host permission, asked
// for that one origin; the script is not kept across browser restarts.

export interface CompatScript {
  readonly id: string;
  readonly matches: string[];
  readonly js: string[];
  readonly world: 'MAIN';
  readonly runAt: 'document_start';
  readonly persistAcrossSessions: false;
}

export interface CompatDeps {
  request(origins: string[]): Promise<boolean>;
  register(script: CompatScript): Promise<void>;
  isRegistered(id: string): Promise<boolean>;
  reload(tabId: number): Promise<void>;
}

export interface ForgetDeps {
  unregister(ids: string[]): Promise<void>;
  removeOrigins(origins: string[]): Promise<boolean>;
}

export const POLYFILL_FILE = 'webmcp-polyfill.js';
/** scheme://host[:port] with a plain host name or IPv4 address: no `*`, no user, no path. */
const HTTP_ORIGIN =
  /^https?:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/i;

export const COMPAT_ID_PREFIX = 'compat-';

export function compatScriptId(origin: string): string {
  return `${COMPAT_ID_PREFIX}${origin.replace(/[^A-Za-z0-9]/g, '_')}`;
}

/** The match pattern for one http(s) origin: `<origin>/*`. Throws for anything else. */
export function sitePattern(origin: string): string {
  if (!HTTP_ORIGIN.test(origin))
    throw new Error(`WebAIAssist works on http(s) sites only: ${origin}`);
  return `${origin}/*`;
}

export async function enableCompat(
  deps: CompatDeps,
  page: { readonly tabId: number; readonly origin: string },
): Promise<'enabled' | 'already' | 'denied'> {
  const match = sitePattern(page.origin);
  // The permission request must be the first await inside the click handler.
  if (!(await deps.request([match]))) return 'denied';
  const id = compatScriptId(page.origin);
  if (await deps.isRegistered(id)) return 'already';
  await deps.register({
    id,
    matches: [match],
    js: [POLYFILL_FILE],
    world: 'MAIN',
    runAt: 'document_start',
    persistAcrossSessions: false,
  });
  await deps.reload(page.tabId);
  return 'enabled';
}

/** Turns compat mode off for a site and gives back its host permission. */
export async function forgetCompat(deps: ForgetDeps, origin: string): Promise<void> {
  const match = sitePattern(origin);
  try {
    await deps.unregister([compatScriptId(origin)]);
  } catch {
    // No script was registered for this site.
  }
  await deps.removeOrigins([match]);
}
