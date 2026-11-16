// SPDX-License-Identifier: Apache-2.0
// The number on the toolbar icon: how many WebMCP tools the open page offers, shown only for a
// site the user has allowed (a host permission the user granted, and the site on the allowed list). For any other page the badge is
// empty and the page's tools are not even listed. The count is the number of tools the assistant
// would be offered (core/tool-offer.ts), so a tool for developers or an unlistable one is not
// counted. The browser calls are injected (entries/shared/badge-wiring.ts); no new permission.
import { offeredTools } from '../core/tool-offer';
import type { ToolListing } from '../core/ports/tool-bridge';

export interface BadgeDeps {
  /** True when Chrome holds the host permission and the user allowed the site (not just an endpoint's host). */
  allowed(origin: string): Promise<boolean>;
  /** The tools of the tab's top frame, with the page's own origin. */
  list(tabId: number): Promise<ToolListing>;
  set(tabId: number, text: string): Promise<void>;
}

const MAX_SHOWN = 99;

/** "" for none, the number up to 99, "99+" above (the icon has room for a few characters). */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
}

/** The origin of an http(s) address, or undefined for anything else. */
function httpOrigin(url: string | undefined): string | undefined {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

async function countFor(deps: BadgeDeps, tab: { id: number; url?: string }): Promise<number> {
  const origin = httpOrigin(tab.url);
  if (origin === undefined || !(await deps.allowed(origin))) return 0;
  const listing = await deps.list(tab.id);
  return offeredTools(listing.tools, listing.origin ?? origin).length;
}

/** Writes the badge of one tab. It never throws: a tab that is gone or a page that does not answer clears it. */
export async function refreshBadge(
  deps: BadgeDeps,
  tab: { readonly id: number; readonly url?: string },
): Promise<void> {
  const count = await countFor(deps, tab).catch(() => 0);
  await deps.set(tab.id, badgeText(count)).catch(() => undefined);
}
