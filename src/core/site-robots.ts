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
