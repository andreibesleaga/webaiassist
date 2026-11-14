// SPDX-License-Identifier: Apache-2.0
// The hook of the "Security review flags" section of the developer report ("Copy report").
// A ReviewFlags function takes the page's tools and returns one row per thing a reviewer should
// look at. Today the default returns nothing: the real rules come from another package, which
// replaces `reviewFlags` (same signature, same file) and adds its tests. toolReport() takes the
// function as an argument, so the report needs no change when the rules arrive.
import type { ToolInfo } from './types';

export interface FlagRow {
  readonly tool: string;
  /** A short code or name of the rule. */
  readonly flag: string;
  readonly detail: string;
}

export type ReviewFlags = (tools: readonly ToolInfo[]) => readonly FlagRow[];

export const reviewFlags: ReviewFlags = () => [];
