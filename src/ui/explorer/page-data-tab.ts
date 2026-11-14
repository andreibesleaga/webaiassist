// SPDX-License-Identifier: Apache-2.0
// The Page data tab: the structured data (JSON-LD) the open page says about itself, as pretty text in a
// <pre> (textContent only, at most 100,000 characters), read from the tab when the tab is first shown.
import { element } from '../dom';
import { t } from '../i18n';
import { onFirstShow } from './first-show';
import type { ExplorerContext, ExplorerTab } from './tabs';

export const PAGE_DATA_CHARS = 100_000;

/** Each JSON-LD block as indented text when it parses, as it came when it does not. */
export function prettyBlocks(blocks: readonly string[]): string {
  return blocks
    .map((block) => {
      try {
        return JSON.stringify(JSON.parse(block), null, 2);
      } catch {
        return block;
      }
    })
    .join('\n\n');
}

async function fill(root: HTMLElement, ctx: ExplorerContext): Promise<void> {
  const status = element(ctx.doc, 'p', t('pageDataLoading'), 'muted');
  status.setAttribute('role', 'status');
  root.append(status);
  const meta = await ctx.query?.pageData().catch(() => undefined);
  const text = prettyBlocks(meta?.jsonLd ?? []);
  if (text === '') {
    status.textContent = t('pageDataNone');
    return;
  }
  status.remove();
  const pre = element(ctx.doc, 'pre', text.slice(0, PAGE_DATA_CHARS), 'page-data');
  pre.tabIndex = 0;
  root.append(pre);
  if (text.length > PAGE_DATA_CHARS) {
    root.append(element(ctx.doc, 'p', t('pageDataCut', { count: PAGE_DATA_CHARS }), 'muted'));
  }
}

export const pageDataTab: ExplorerTab = {
  id: 'page-data',
  labelKey: 'explorerTabPageData',
  mount: (root, ctx) => {
    if (!ctx.query) return;
    root.append(
      element(ctx.doc, 'h2', t('pageDataHeading')),
      element(ctx.doc, 'p', t('pageDataIntro'), 'muted'),
    );
    onFirstShow(root, () => void fill(root, ctx));
  },
};
