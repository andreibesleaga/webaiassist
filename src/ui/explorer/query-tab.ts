// SPDX-License-Identifier: Apache-2.0
// Placeholder of the Query tab: empty on purpose. The package that builds it fills this file,
// adds its labelKey to messages-query-en.ts and its entry to EXPLORER_TABS in tabs.ts.
import type { ExplorerTab } from './tabs';

export const queryTab: Omit<ExplorerTab, 'labelKey'> = {
  id: 'query',
  mount: () => undefined,
};
