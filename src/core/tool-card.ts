// SPDX-License-Identifier: Apache-2.0
// What the card says about each WebMCP tool of the page: its name, one line of what it does
// (the page's own words, cut, with hidden characters made visible) and whether it reads or
// changes. A tool the page does not mark as read-only counts as one that changes something,
// the same rule as the confirmation gate.
import { needsConfirmation } from './gate';
import { revealInvisible } from './sanitize';
import type { ToolInfo } from './types';

export type ToolEffect = 'reads' | 'changes';

export interface ToolRow {
  readonly name: string;
  /** The first sentence of the description, at most 90 characters, for one line. */
  readonly summary: string;
  /** More of the description, at most 200 characters, for a tooltip. */
  readonly detail: string;
  readonly effect: ToolEffect;
  /** The page gave no readOnlyHint at all. */
  readonly unmarked: boolean;
  /** The page says the tool's results are page content. */
  readonly pageContent: boolean;
}

const NAME_CAP = 64;
const SUMMARY_CAP = 90;
const DETAIL_CAP = 200;

/** Control characters other than tab and line breaks become [U+XXXX]; hidden characters too. */
export function visible(text: string): string {
  let out = '';
  for (const char of revealInvisible(text)) {
    const code = char.codePointAt(0) ?? 0;
    const control =
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0x7f && code <= 0x9f);
    out += control ? `[U+${code.toString(16).toUpperCase().padStart(4, '0')}]` : char;
  }
  return out;
}

function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1)}…`;
}

function firstSentence(text: string): string {
  const end = /[.!?](\s|$)/.exec(text);
  return end ? text.slice(0, end.index + 1) : text;
}

export function toolRow(tool: ToolInfo): ToolRow {
  const description = visible(tool.description);
  return {
    name: clip(visible(tool.name), NAME_CAP),
    summary: clip(firstSentence(description.replace(/\s+/g, ' ').trim()), SUMMARY_CAP),
    detail: clip(description, DETAIL_CAP),
    effect: needsConfirmation(tool) ? 'changes' : 'reads',
    unmarked: tool.annotations?.readOnlyHint === undefined,
    pageContent: tool.annotations?.untrustedContentHint === true,
  };
}

/** Reads first, then changes, then by name. */
export function toolRows(tools: readonly ToolInfo[]): ToolRow[] {
  const rank = (row: ToolRow): number => (row.effect === 'reads' ? 0 : 1);
  return tools
    .map(toolRow)
    .sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function countEffects(rows: readonly ToolRow[]): { reads: number; changes: number } {
  const reads = rows.filter((row) => row.effect === 'reads').length;
  return { reads, changes: rows.length - reads };
}
