// SPDX-License-Identifier: Apache-2.0
// The one activity log of this page (the side panel and the explorer page each open it; both
// read the same IndexedDB database of the extension).
import { openIndexedDbActivity } from '../../adapters/indexeddb-activity';
import type { ActivityLog } from '../../core/ports/activity-log';

let opened: Promise<ActivityLog> | undefined;

export function activityLog(): Promise<ActivityLog> {
  return (opened ??= openIndexedDbActivity());
}

/** The log as the ActivityLog port, opened on first use. */
export const lazyActivityLog: ActivityLog = {
  append: async (record) => (await activityLog()).append(record),
  list: async () => (await activityLog()).list(),
  forgetSite: async (origin) => (await activityLog()).forgetSite(origin),
  clear: async () => (await activityLog()).clear(),
  includeContent: async () => (await activityLog()).includeContent(),
  setIncludeContent: async (on) => (await activityLog()).setIncludeContent(on),
};
