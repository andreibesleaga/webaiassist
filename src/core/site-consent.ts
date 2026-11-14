// SPDX-License-Identifier: Apache-2.0
// Per-site permission: the first time the user asks about a site in a session, the panel
// asks whether WebAIAssist may use that site's tools. An Allow lasts for the session.
import type { SiteGrants } from './ports/site-grants';

export interface SiteRequest {
  readonly origin: string;
  readonly toolCount: number;
}

export type AskSite = (request: SiteRequest) => Promise<boolean>;

export async function siteAllowed(
  grants: SiteGrants,
  ask: AskSite,
  site: SiteRequest,
): Promise<boolean> {
  if (await grants.has(site.origin)) return true;
  if (!(await ask(site))) return false;
  await grants.add(site.origin);
  return true;
}
