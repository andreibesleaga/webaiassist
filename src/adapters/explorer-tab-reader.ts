// SPDX-License-Identifier: Apache-2.0
// How the explorer page reads the open node's files: through the tab it was opened for, with the
// fixed lists (src/core/site-files.ts for the linkset, src/core/graph-files.ts for the rest).
// The page script in the tab answers with the origin it ran on; when that is not the origin the
// explorer was opened for, the tab has left the site: that read, and every later one, ends with a
// plain sentence and sends nothing.
import { graphSpecOf, type GraphFileId } from '../core/graph-files';
import { specOf, type FileOutcome } from '../core/site-files';
import { readGraphFile } from './graph-files';
import { readSiteFile, type SiteReadDeps, type SiteTarget } from './site-files';

export const TAB_LEFT_TEXT = 'The tab left this site, so WebAIAssist stopped reading.';

/** The linkset and the four graph files: everything a tab of the explorer page reads through the tab. */
export type TabFile = 'linkset' | GraphFileId;

export type TabReader = (spec: TabFile) => Promise<FileOutcome>;

const originOf = (result: unknown): unknown =>
  typeof result === 'object' && result !== null
    ? (result as { origin?: unknown }).origin
    : undefined;

export function createTabReader(deps: SiteReadDeps, target: SiteTarget): TabReader {
  let left = false;
  const watching: SiteReadDeps = {
    ...deps,
    scripting: {
      executeScript: async (injection) => {
        const results = await deps.scripting.executeScript(injection);
        if (originOf(results[0]?.result) !== target.origin) left = true;
        return results;
      },
    },
  };
  return async (spec) => {
    if (left) throw new Error(TAB_LEFT_TEXT);
    const outcome =
      spec === 'linkset'
        ? await readSiteFile(watching, target, specOf('linkset'))
        : await readGraphFile(watching, target, graphSpecOf(spec));
    if (left) throw new Error(TAB_LEFT_TEXT);
    return outcome;
  };
}
