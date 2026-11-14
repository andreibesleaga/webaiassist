// SPDX-License-Identifier: Apache-2.0
// "Forget this site" in the side panel: removes what WebAIAssist keeps about one site.
// Its chat and tool counts (memory), the "use the tools of this site" answer of this
// session, the compat-mode script, and the host access the user granted for it.
import type { Memory } from '../core/ports/memory';
import { forgetCompat, type ForgetDeps } from './compat-mode';

export interface ForgetSiteDeps {
  readonly memory: Pick<Memory, 'clear'>;
  readonly grants: { remove(origin: string): Promise<void> };
  readonly compat: ForgetDeps;
}

const HTTP_ORIGIN = /^https?:\/\/[^/]+$/;

export async function forgetSite(deps: ForgetSiteDeps, origin: string): Promise<void> {
  if (!HTTP_ORIGIN.test(origin)) throw new Error(`Only http and https sites can be forgotten.`);
  await deps.memory.clear(origin);
  await deps.grants.remove(origin);
  await forgetCompat(deps.compat, origin);
}

export interface ForgetAllDeps {
  readonly memory: Pick<Memory, 'clear'>;
  readonly grants: { clear(): Promise<void> };
  readonly compat: {
    unregisterAll(): Promise<void>;
    /** Host patterns the user granted, as Chrome lists them. */
    grantedOrigins(): Promise<readonly string[]>;
    removeOrigins(origins: string[]): Promise<boolean>;
  };
  /** Host patterns that stay: the chat endpoint's address is not a site the user allowed. */
  readonly keep: readonly string[];
}

/** "Forget all sites": every chat and tool count, every "use the tools of this site" answer, every
 *  compat script and every host access, except the endpoint's. */
export async function forgetAllSites(deps: ForgetAllDeps): Promise<void> {
  await deps.memory.clear();
  await deps.grants.clear();
  await deps.compat.unregisterAll();
  const origins = (await deps.compat.grantedOrigins()).filter((o) => !deps.keep.includes(o));
  if (origins.length > 0) await deps.compat.removeOrigins(origins);
}
