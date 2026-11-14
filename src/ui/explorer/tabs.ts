// SPDX-License-Identifier: Apache-2.0
// The sections of the explorer page, in order. Each one is a tab (shell.ts) with a panel it fills
// in `mount`. This package ships the Graph tab; the Query, Vocabulary and Page data tabs are added
// here, one line each, by the package that builds them (their files exist as empty placeholders).
import type { ExplorerTarget } from '../explorer-url';
import type { GuardedFile } from '../../adapters/graph-fetch-guard';
import type { FileOutcome } from '../../core/site-files';
import type { MessageKey } from '../messages-en';
import { graphTab } from './graph-tab';

export interface ExplorerContext {
  readonly doc: Document;
  readonly target: ExplorerTarget;
  /** One fixed file of the open node, read through the tab. */
  readTab(spec: GuardedFile): Promise<FileOutcome>;
  /** Peer origins the user ticked, in normal form; the fetch guard reads the same set. */
  readonly approved: Set<string>;
}

export interface ExplorerTab {
  readonly id: string;
  readonly labelKey: MessageKey;
  mount(root: HTMLElement, ctx: ExplorerContext): void;
}

export const EXPLORER_TABS: readonly ExplorerTab[] = [graphTab];
