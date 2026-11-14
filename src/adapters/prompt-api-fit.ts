// SPDX-License-Identifier: Apache-2.0
// Keeps the earlier turns of a question inside what Chrome's built-in model can take, when Chrome
// (or its measure) says the input was too long: the oldest turns go first.
import { estimateTokens } from '../core/history';
import type { RuntimeMessage } from './chat-messages';

const SAFETY = 0.9;

/**
 * The turns without their oldest ones, so that the earlier turns shrink in the proportion
 * `room / needed` (what fits over what was asked for). System turns stay. The kept turns start
 * on a user turn. Returns undefined when there is no turn to remove.
 */
export function shrinkTurns(
  turns: readonly RuntimeMessage[],
  room: number,
  needed: number,
): RuntimeMessage[] | undefined {
  const system = turns.filter((m) => m.role === 'system');
  const rest = turns.filter((m) => m.role !== 'system');
  if (rest.length === 0) return undefined;
  const tokens = (list: readonly RuntimeMessage[]): number =>
    list.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const budget = Math.floor(tokens(rest) * Math.min(1, (room / needed) * SAFETY));
  const kept = [...rest];
  kept.shift();
  while (kept.length > 0 && (tokens(kept) > budget || kept[0]?.role !== 'user')) kept.shift();
  return [...system, ...kept];
}

interface Measurable {
  readonly contextUsage?: number;
  readonly inputUsage?: number;
  measureContextUsage?(input: string): Promise<number>;
  measureInputUsage?(input: string): Promise<number>;
}

/** The tokens the session already holds plus `last`, by Chrome's own measure (old names
 *  `inputUsage` and `measureInputUsage` too); undefined when this Chrome has none. */
export async function measureInput(session: Measurable, last: string): Promise<number | undefined> {
  const used = session.contextUsage ?? session.inputUsage;
  if (typeof used !== 'number') return undefined;
  try {
    if (typeof session.measureContextUsage === 'function') {
      return used + (await session.measureContextUsage(last));
    }
    if (typeof session.measureInputUsage === 'function') {
      return used + (await session.measureInputUsage(last));
    }
  } catch {
    return undefined;
  }
  return undefined;
}
