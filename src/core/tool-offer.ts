// SPDX-License-Identifier: Apache-2.0
// Which of a page's tools the run may use, and what the review found about each. One function
// for the loop's listing (tool-step.ts listOnSite) and the card (panel-page.ts), so the card
// shows what the model is offered, plus the tools only the user may run.
import { listableTool } from './sanitize';
import { reviewTools, type DefinitionLedger } from './tool-review';
import type { ToolInfo } from './types';

/** A tool marked for developers: the model is not offered it; the user still sees and may run it. */
export const forDevelopers = (tool: ToolInfo): boolean => tool.annotations?.debugging === true;

/** The tools of a card list that the model is offered: not the ones marked for developers. */
export const forModel = (tools: readonly ToolInfo[]): ToolInfo[] =>
  tools.filter((tool) => !forDevelopers(tool));

export interface OfferOptions {
  readonly ledger?: DefinitionLedger | undefined;
  /** The run was started by the user by hand: developer tools stay in. */
  readonly manual?: boolean | undefined;
}

/** Tools the model may see (listableTool, not for developers), each with its review written on it. */
export function offeredTools(
  tools: readonly ToolInfo[],
  origin: string,
  options: OfferOptions = {},
): ToolInfo[] {
  const usable = tools.filter(listableTool);
  const reviewed = reviewTools(usable, origin, options.ledger);
  return options.manual === true ? reviewed : reviewed.filter((tool) => !forDevelopers(tool));
}
