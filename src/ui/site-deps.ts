// SPDX-License-Identifier: Apache-2.0
// What the panel needs from the browser to follow the open page and to read the site: the
// tab's title and address, the reads of the site's files, and the browser events that mean
// "the page in front changed". The side-panel entry builds the real ones.
import type { SiteTarget } from '../adapters/site-files';
import type { Outcomes } from '../core/site-facts';
import type { PageMeta } from '../core/site-page';

export type BrowserEvent =
  | { readonly kind: 'tab-activated' }
  | {
      readonly kind: 'tab-updated';
      readonly tabId: number;
      readonly status?: 'loading' | 'complete';
      /** Set when the tab's address changed (also an in-page change). */
      readonly url?: string;
      /** Set when the tab's title changed. */
      readonly title?: string;
    }
  | { readonly kind: 'window-focus' }
  | { readonly kind: 'access-changed' };

export interface SiteDeps {
  /** The files of the site, read once per call. Called only for an allowed site. */
  files(target: SiteTarget): Promise<Outcomes>;
  /** What the open page says about itself (JSON-LD, Open Graph, meta). */
  page(target: SiteTarget): Promise<PageMeta | undefined>;
  /** The tab's title and address; empty for a tab the extension may not read. */
  tab(tabId: number): Promise<{ readonly title?: string; readonly url?: string }>;
  /** Calls `listener` for each browser event that can change the open page; returns a stop function. */
  events(listener: (event: BrowserEvent) => void): () => void;
}
