// SPDX-License-Identifier: Apache-2.0
// The size cap of the activity log. Oldest entries go first.

/**
 * 8 MiB of stored entries. Reason: entries with names and sizes only are about 1 to 2 KB, so the
 * cap holds several thousand questions; with "include content" an entry is bigger (each text is
 * cut at CONTENT_LIMIT characters) and fewer fit. A larger log would make the Activity tab and
 * the export slow, because the tab reads every entry, and the log is a record of recent use, not
 * an archive: the export is how a user keeps more.
 */
export const ACTIVITY_CAP_BYTES = 8 * 1024 * 1024;

/** Longest text kept for one question, one argument set or one result, in characters. */
export const CONTENT_LIMIT = 4000;

/** The oldest entries to remove so that the rest fit in `cap` bytes. The newest entry is never
 *  removed, even when it alone is above the cap. `entries` are oldest first. */
export function overflow(
  entries: readonly { readonly id: string; readonly bytes: number }[],
  cap: number = ACTIVITY_CAP_BYTES,
): string[] {
  let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const remove: string[] = [];
  for (const entry of entries.slice(0, -1)) {
    if (total <= cap) break;
    remove.push(entry.id);
    total -= entry.bytes;
  }
  return remove;
}
