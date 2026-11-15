// SPDX-License-Identifier: Apache-2.0
// "Forget this site" and "Forget all sites" also remove the activity log's entries. The log
// is a record about the sites the user used, so forgetting a site forgets it there too.
import type { ActivityLog } from '../core/ports/activity-log';
import type { Memory } from '../core/ports/memory';

/** A memory whose `clear` also clears the activity log for the same site, or for every site. */
export function withActivity(
  memory: Pick<Memory, 'clear'>,
  activity: Pick<ActivityLog, 'forgetSite' | 'clear'>,
): Pick<Memory, 'clear'> {
  return {
    async clear(origin) {
      await memory.clear(origin);
      await (origin === undefined ? activity.clear() : activity.forgetSite(origin));
    },
  };
}
