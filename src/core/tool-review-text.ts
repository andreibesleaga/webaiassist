// SPDX-License-Identifier: Apache-2.0
// The plain sentence for each finding of the tool security review (tool-review.ts). One place
// for the side panel (messages-parity-en.ts) and for the developer report (review-flags.ts).
// `{detail}` is replaced by the finding's short word or tool name, which came from the page.
import type { ToolFlag } from './types';

export const FLAG_REASONS = {
  'hidden-characters': 'The description has hidden characters, which can hide text from you.',
  instructions: 'The description reads like orders to the AI, not like a description for you.',
  'names-other-tool': 'The description tells the AI to call another tool of this page: {detail}.',
  'look-alike':
    'The name is a look-alike: it imitates another word ({detail}) or another tool of this page.',
  link: 'The description or its fields contain a web address or link.',
  encoded: 'The description or its fields contain encoded text.',
  'read-only-contradicted':
    'Marked read-only, but its name or fields point to a change or a secret: {detail}.',
  oversized: 'The definition is unusually long.',
  changed: 'The page changed this tool since this panel first saw it.',
} as const;

/** The sentence for a finding; the id itself for an id this version does not know. */
export function flagReason(flag: ToolFlag): string {
  const text = (FLAG_REASONS as Record<string, string>)[flag.id];
  if (text === undefined) return flag.id;
  return text
    .replace(' ({detail})', flag.detail ? ` (${flag.detail})` : '')
    .replace('{detail}', flag.detail ?? 'another tool');
}
