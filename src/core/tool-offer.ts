// SPDX-License-Identifier: Apache-2.0
// Which of a page's tools the run may use, and what the review found about each. One function
// for the loop's listing (tool-step.ts listOnSite) and the card (panel-page.ts), so the card
// shows what the model is offered, plus the tools only the user may run.
import { toolLine } from './prompt';
import { listableTool } from './sanitize';
import { reviewTools, type DefinitionLedger } from './tool-review';
import type { ToolInfo } from './types';

/** A tool marked for developers: the model is not offered it; the user still sees and may run it. */
export const forDevelopers = (tool: ToolInfo): boolean => tool.annotations?.debugging === true;

/** Why the model is not offered a tool of the page (the card says it in words):
 *  `marker`, its name or a schema value holds a turn marker or hidden text (listableTool);
 *  `schema-size`, its field schema is over SCHEMA_CAP characters; `list-cap`, the tools before it
 *  already fill LIST_CAP characters. The last two bound the prompt (OWASP LLM10). */
export type NotOfferedReason = 'marker' | 'schema-size' | 'list-cap';

/** The same limit as the review's `oversized` finding. */
export const SCHEMA_CAP = 8_000;
/** All tool lines of the prompt together. */
export const LIST_CAP = 24_000;

const schemaLength = (tool: ToolInfo): number => JSON.stringify(tool.inputSchema ?? {}).length;

/** The tools of the page the model is not offered, by name, with the reason; page order. */
export function notOffered(tools: readonly ToolInfo[]): Map<string, NotOfferedReason> {
  const out = new Map<string, NotOfferedReason>();
  let used = 0;
  for (const tool of tools) {
    if (!listableTool(tool)) out.set(tool.name, 'marker');
    else if (schemaLength(tool) > SCHEMA_CAP) out.set(tool.name, 'schema-size');
    else {
      used += toolLine(tool).length;
      if (used > LIST_CAP) out.set(tool.name, 'list-cap');
    }
  }
  return out;
}

/** The tools of a card list that the model is offered: not the ones marked for developers,
 *  nor the ones notOffered names. */
export function forModel(tools: readonly ToolInfo[]): ToolInfo[] {
  const shown = tools.filter((tool) => !forDevelopers(tool));
  const refused = notOffered(shown);
  return shown.filter((tool) => !refused.has(tool.name));
}

export interface OfferOptions {
  readonly ledger?: DefinitionLedger | undefined;
  /** The run was started by the user by hand: developer tools stay in. */
  readonly manual?: boolean | undefined;
}

/** Tools the model may see (forModel), each with its review written on it; with `manual`, every
 *  tool of the page, for the card and for a run by hand. */
export function offeredTools(
  tools: readonly ToolInfo[],
  origin: string,
  options: OfferOptions = {},
): ToolInfo[] {
  if (options.manual === true) return reviewTools(tools, origin, options.ledger);
  const reviewed = reviewTools(tools.filter(listableTool), origin, options.ledger);
  return forModel(reviewed);
}
