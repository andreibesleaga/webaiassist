// SPDX-License-Identifier: Apache-2.0
// Re-running a past tool call from the activity log. It goes the same way a new call goes: the
// site must already be allowed in this session (the side panel asks that question; this page
// does not ask it again), the tab must be on the same site, the page must still list the tool
// unchanged, and the user is asked, whatever the tool's hints say. Nothing runs without the
// user's Allow. The question is built by the caller from the same parts as the side panel's
// question, with the tool carrying its review (listed through offeredTools, as for a manual run).
import { REDACTED, REMOVED } from './export';
import { sameTool } from './gate';
import type { ToolCall } from './ports/activity-log';
import type { ToolCallApproval } from './ports/chat-ui';
import type { SiteGrants } from './ports/site-grants';
import type { ToolBridge } from './ports/tool-bridge';
import { offeredTools } from './tool-offer';
import type { ToolArgs, ToolInfo } from './types';

export interface RerunDeps {
  readonly bridge: ToolBridge;
  /** Sites the user allowed in this session; a re-run never runs on any other site. */
  readonly grants: Pick<SiteGrants, 'has'>;
  /**
   * The confirmation of the tool call. The tool carries its review; the caller shows the same
   * question as the side panel (full arguments, review, hints, a second question when needed).
   */
  confirm(request: ToolCallApproval): Promise<boolean>;
}

export type RerunResult =
  | { readonly state: 'ran'; readonly ok: boolean; readonly text: string }
  | {
      readonly state:
        | 'denied'
        | 'no-arguments'
        | 'site-not-allowed'
        | 'other-site'
        | 'tool-missing'
        | 'tool-changed';
    };

/** Both markers the log writes where it hid a value. */
const HIDDEN = [`"${REDACTED}"`, REMOVED];

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function listed(
  bridge: ToolBridge,
  tabId: number,
  origin: string,
  name: string,
): Promise<{ tool?: ToolInfo; otherSite: boolean }> {
  const listing = await bridge.list(tabId);
  if (listing.origin !== origin) return { otherSite: true };
  const offered = offeredTools(listing.tools, origin, { manual: true });
  return { tool: offered.find((t) => t.name === name), otherSite: false };
}

/** Saved arguments that can be sent again: an object with no value hidden by the log. */
function isRunnable(args: unknown): boolean {
  if (typeof args !== 'object' || args === null) return false;
  const text = JSON.stringify(args);
  return !HIDDEN.some((marker) => text.includes(marker));
}

export async function rerunToolCall(
  deps: RerunDeps,
  target: { readonly tabId: number; readonly origin: string },
  past: ToolCall,
): Promise<RerunResult> {
  if (!isRunnable(past.args)) {
    return { state: 'no-arguments' };
  }
  const args = past.args as ToolArgs;
  if (!(await deps.grants.has(target.origin))) return { state: 'site-not-allowed' };
  const first = await listed(deps.bridge, target.tabId, target.origin, past.name);
  if (first.otherSite) return { state: 'other-site' };
  if (!first.tool || past.builtin) return { state: 'tool-missing' };
  if (!(await deps.confirm({ tool: first.tool, args, origin: target.origin }))) {
    return { state: 'denied' };
  }
  const again = await listed(deps.bridge, target.tabId, target.origin, past.name);
  if (again.otherSite) return { state: 'other-site' };
  if (!sameTool(first.tool, again.tool)) return { state: 'tool-changed' };
  try {
    const result = await deps.bridge.call(target, past.name, args);
    return { state: 'ran', ok: result.ok, text: result.text };
  } catch (error) {
    return { state: 'ran', ok: false, text: `Tool error: ${errorText(error)}` };
  }
}
