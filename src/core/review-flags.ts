// SPDX-License-Identifier: Apache-2.0
// The "Security review flags" section of the developer report ("Copy report"): one row per
// finding of the tool security review (tool-review.ts), with a plain reason. toolReport() takes
// the function as an argument, so a test can give it another one.
import { visible } from './tool-card';
import { reviewTool } from './tool-review';
import { flagReason } from './tool-review-text';
import type { ToolInfo } from './types';

export interface FlagRow {
  readonly tool: string;
  /** The id of the rule. */
  readonly flag: string;
  readonly detail: string;
}

export type ReviewFlags = (tools: readonly ToolInfo[]) => readonly FlagRow[];

export const reviewFlags: ReviewFlags = (tools) =>
  tools.flatMap((tool) =>
    reviewTool(tool, tools).map((flag) => ({
      tool: tool.name,
      flag: flag.id,
      detail: visible(flagReason(flag)),
    })),
  );
