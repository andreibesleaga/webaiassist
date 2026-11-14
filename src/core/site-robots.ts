// SPDX-License-Identifier: Apache-2.0
// What robots.txt says about AI input, and the one place that decides what the panel does with
// it. Only the `Content-Signal` line of the group for every agent ("*") counts: the extension is
// not a crawler, it acts for the person who opened the page. Allow and Disallow are not read.
import type { FileOutcome } from './site-files';

export interface ContentSignal {
  readonly search?: boolean;
  readonly aiInput?: boolean;
  readonly aiTrain?: boolean;
}

const MAX_LINES = 5000;

function signalOf(value: string): ContentSignal {
  const out: { search?: boolean; aiInput?: boolean; aiTrain?: boolean } = {};
  for (const part of value.split(',')) {
    const [key, answer] = part.split('=').map((piece) => piece.trim().toLowerCase());
    const flag = answer === 'yes' ? true : answer === 'no' ? false : undefined;
    if (flag === undefined) continue;
    if (key === 'search') out.search = flag;
    if (key === 'ai-input') out.aiInput = flag;
    if (key === 'ai-train') out.aiTrain = flag;
  }
  return out;
}

/** The last Content-Signal of the "*" group, or {} when there is none. */
export function parseRobots(raw: string): ContentSignal {
  let inStar = false;
  let afterAgent = false;
  let found: ContentSignal = {};
  for (const line of raw.split(/\r?\n/).slice(0, MAX_LINES)) {
    const at = line.indexOf(':');
    if (line.trimStart().startsWith('#') || at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === 'user-agent') {
      inStar = (afterAgent ? inStar : false) || value === '*';
      afterAgent = true;
      continue;
    }
    afterAgent = false;
    if (inStar && key === 'content-signal') found = signalOf(value);
  }
  return found;
}

export interface RobotsGroup {
  /** The `User-agent` names of the group, as written (capped). */
  readonly agents: readonly string[];
  readonly signal: ContentSignal;
}

const MAX_GROUPS = 20;
const MAX_AGENTS = 10;

/**
 * Every group of the file that has a Content-Signal line, with all its values. For showing only:
 * the "no AI input" decision reads the "*" group alone (decideAiInput).
 */
export function parseRobotsGroups(raw: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let afterAgent = false;
  for (const line of raw.split(/\r?\n/).slice(0, MAX_LINES)) {
    const at = line.indexOf(':');
    if (line.trimStart().startsWith('#') || at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === 'user-agent') {
      agents = [...(afterAgent ? agents : []), value.slice(0, 60)].slice(0, MAX_AGENTS);
      afterAgent = true;
      continue;
    }
    afterAgent = false;
    if (key === 'content-signal' && groups.length < MAX_GROUPS) {
      groups.push({ agents, signal: signalOf(value) });
    }
  }
  return groups;
}

export type AiInput = 'allowed' | 'blocked' | 'not-stated' | 'unreadable';

/** A site that could not be asked is "not stated" unless the answer was lost or too big. */
function unreadable(outcome: FileOutcome): boolean {
  if (outcome.state === 'unavailable') return outcome.why !== 'denied';
  return outcome.state === 'not-usable' && outcome.why === 'size';
}

/** The decision of the signal rules (research note, 1.4, cases S0 to S4), in one place. */
export function decideAiInput(robots: FileOutcome | undefined): AiInput {
  if (robots === undefined) return 'not-stated';
  if (robots.state !== 'found') return unreadable(robots) ? 'unreadable' : 'not-stated';
  const { aiInput } = parseRobots(robots.text);
  if (aiInput === undefined) return 'not-stated';
  return aiInput ? 'allowed' : 'blocked';
}
