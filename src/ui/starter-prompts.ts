// SPDX-License-Identifier: Apache-2.0
// The three questions offered in the empty chat on a node. Each is shown only when the page has
// the tool it needs (a brief, a search, and explain for a rule code), so a click starts a
// question the page can answer. The box is filled and nothing is sent.
import type { ToolInfo } from '../core/types';
import { t } from './i18n';
import type { MessageKey } from './messages-en';

const STARTERS: readonly (readonly [string, MessageKey])[] = [
  ['brief', 'starterBrief'],
  ['search', 'starterSearch'],
  ['explain', 'starterExplain'],
];

export function starterPrompts(tools: readonly Pick<ToolInfo, 'name'>[]): string[] {
  const names = new Set(tools.map((tool) => tool.name));
  return STARTERS.filter(([tool]) => names.has(tool)).map(([, key]) => t(key));
}
