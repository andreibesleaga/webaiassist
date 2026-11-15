// SPDX-License-Identifier: Apache-2.0
// Re-running a past tool call from the activity log. It goes the same way a new call goes: the
// tab must be on the same site, the page must still list the tool unchanged, and the user is
// asked, whatever the tool's hints say. Nothing runs without the user's Allow.
import { sameTool } from './gate';
import type { ToolCall } from './ports/activity-log';
import type { ToolCallApproval } from './ports/chat-ui';
import type { ToolBridge } from './ports/tool-bridge';
import type { ToolArgs, ToolInfo } from './types';

export interface RerunDeps {
  readonly bridge: ToolBridge;
  /** The normal confirmation of the tool call (the same question as in the side panel). */
  confirm(request: ToolCallApproval): Promise<boolean>;
}

export type RerunResult =
  | { readonly state: 'ran'; readonly ok: boolean; readonly text: string }
  | {
      readonly state: 'denied' | 'no-arguments' | 'other-site' | 'tool-missing' | 'tool-changed';
    };

const HIDDEN = '"[redacted]"';

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
  return { tool: listing.tools.find((t) => t.name === name), otherSite: false };
}

/** Saved arguments that can be sent again: an object with no value hidden by the log. */
function isRunnable(args: unknown): boolean {
  return typeof args === 'object' && args !== null && !JSON.stringify(args).includes(HIDDEN);
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
