// SPDX-License-Identifier: Apache-2.0
// Per-site permission: the first time a tool of a site is about to be used in a session, the
// panel asks whether WebAIAssist may use that site's tools (not before: a question that needs
// no tool asks nothing). An Allow lasts for the session; a Deny lasts for the rest of the run.
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

/**
 * The gate the agent loop calls before every tool call (AgentDeps.siteGate): the site question
 * is asked at the first call only; after a Deny the rest of the run is refused without asking
 * again, and `onDenied` is told once.
 */
export function siteGate(
  grants: SiteGrants,
  ask: AskSite,
  site: SiteRequest,
  onDenied: () => void,
): () => Promise<boolean> {
  let refused = false;
  return async () => {
    if (refused) return false;
    if (await siteAllowed(grants, ask, site)) return true;
    refused = true;
    onDenied();
    return false;
  };
}
