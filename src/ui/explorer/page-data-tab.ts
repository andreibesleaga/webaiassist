// SPDX-License-Identifier: Apache-2.0
// Placeholder of the Page data tab: empty on purpose. The package that builds it fills this file,
// adds its labelKey to messages-query-en.ts and its entry to EXPLORER_TABS in tabs.ts.
import type { ExplorerTab } from './tabs';

export const pageDataTab: Omit<ExplorerTab, 'labelKey'> = {
  id: 'page-data',
  mount: () => undefined,
};
