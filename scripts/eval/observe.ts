// SPDX-License-Identifier: Apache-2.0
// Pure helpers of the panel observer (panel.ts): what the transcript shows, when the first
// token came, which tool a confirmation question names. No browser here, so Vitest covers it.

/** One transcript item as the panel page shows it. */
export interface Item {
  /** The speaker label of a user or answer turn; null for tool calls, results and notes. */
  readonly who: string | null;
  /** The item is a tool result marked data-trust="untrusted". */
  readonly untrusted: boolean;
  /** The item's text without the speaker label and without nested untrusted blocks. */
  readonly text: string;
}

/** What the observer saw at one moment of a question. */
export interface Snapshot {
  readonly t: number;
  /** Items that are not the user's turn. */
  readonly others: number;
  /** Text of the last of them. */
  readonly last: string;
  readonly gate: boolean;
}

export const USER_LABEL = 'You';

const TOOL_QUESTION = /^Run the tool (.+)\?$/;

/** The tool named by a "Run the tool X?" question; null for the site question or anything else. */
export function toolFromTitle(title: string): string | null {
  return TOOL_QUESTION.exec(title.trim())?.[1] ?? null;
}

/** The answer: the text of the last item that is a turn of the assistant (not the user's, not
 *  untrusted). Empty when there is none. */
export function pickAnswer(items: readonly Item[]): string {
  const turns = items.filter((i) => i.who !== null && i.who !== USER_LABEL && !i.untrusted);
  return (turns.at(-1)?.text ?? '').trim();
}

/** Transcript lines that report an error ("Error: …"). */
export function errorLines(items: readonly Item[]): string[] {
  return items.filter((i) => i.who === null && /^Error/.test(i.text)).map((i) => i.text.trim());
}

/** How many times the loop declined to run a tool call it had already made (its notes in the
 *  transcript, see src/core/repeat.ts). */
export function repeatedCalls(items: readonly Item[]): number {
  const note = /^The assistant repeated a tool call/;
  return items.filter((i) => i.who === null && note.test(i.text.trim())).length;
}

/** The transcript as a snapshot at time `t`. */
export function snapshotOf(t: number, items: readonly Item[], gate: boolean): Snapshot {
  const others = items.filter((i) => i.who !== USER_LABEL);
  return { t, others: others.length, last: others.at(-1)?.text ?? '', gate };
}

/** Milliseconds from `startMs` to the first token: the first snapshot that differs from the first
 *  one by a new item, longer text of the last item, or a confirmation question. Null when none. */
export function firstTokenMs(snaps: readonly Snapshot[], startMs: number): number | null {
  const base = snaps[0];
  if (!base) return null;
  const hit = snaps.find(
    (s) => s.gate || s.others > base.others || s.last.length > base.last.length,
  );
  return hit ? hit.t - startMs : null;
}

/** Percent of a progress element (value 0..1) as text, "?" when it is not a number. */
export function percent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : '?';
}

const FAILED = /error|failed|did not load|cancel|integrity|mismatch|no usable/i;

/** The model line says the model is ready, failed, or is still loading. */
export function modelState(status: string): 'ready' | 'failed' | 'loading' {
  if (status.startsWith('Ready')) return 'ready';
  return FAILED.test(status) ? 'failed' : 'loading';
}

/** The tool count in "<host> — N WebMCP tools" or "… 1 WebMCP tool"; 0 when the page has none. */
export function toolCount(pageStatus: string): number {
  return Number(/(\d+) WebMCP tools?/.exec(pageStatus)?.[1] ?? 0);
}
