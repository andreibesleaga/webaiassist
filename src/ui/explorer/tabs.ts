// SPDX-License-Identifier: Apache-2.0
// The sections of the explorer page, in order. Each one is a tab (shell.ts) with a panel it fills
// in `mount`. This package ships the Graph tab; the Query, Vocabulary and Page data tabs are added
// here, one line each, by the package that builds them (their files exist as empty placeholders).
import type { ExplorerTarget } from '../explorer-url';
import type { TabFile } from '../../adapters/explorer-tab-reader';
import type { FileOutcome } from '../../core/site-files';
import type { MessageKey } from '../messages-en';
import type { QuerySession } from '../../adapters/query-session';
import type { PageMeta } from '../../core/site-page';
import { graphTab } from './graph-tab';
import { pageDataTab } from './page-data-tab';
import { queryTab } from './query-tab';
import { vocabTab } from './vocab-tab';

export interface ExplorerContext {
  readonly doc: Document;
  readonly target: ExplorerTarget;
  /** One fixed file of the open node, read through the tab. */
  readTab(spec: TabFile): Promise<FileOutcome>;
  /** Peer origins the user ticked, in normal form; the fetch guard reads the same set. */
  readonly approved: Set<string>;
  /** What the Query, Vocabulary and Page data tabs read with; a page without it shows none of them. */
  readonly query?: QueryTabDeps;
}

/** The query worker for the node's graph, a second one for its vocabulary, and the open page's data. */
export interface QueryTabDeps {
  readonly graph: QuerySession;
  readonly vocabulary: QuerySession;
  pageData(): Promise<PageMeta | undefined>;
}

export interface ExplorerTab {
  readonly id: string;
  readonly labelKey: MessageKey;
  mount(root: HTMLElement, ctx: ExplorerContext): void;
}

export const EXPLORER_TABS: readonly ExplorerTab[] = [graphTab, queryTab, vocabTab, pageDataTab];
