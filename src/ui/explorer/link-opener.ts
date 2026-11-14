// SPDX-License-Identifier: Apache-2.0
// Links in the explorer's detail panel come from the node's graph (http and https only, checked by
// the site's code). A click on one opens it in a new tab with no opener and no referrer, so the
// explorer tab itself is never navigated away and the other site gets no handle on it.
export function bindLinkOpener(doc: Document, open: (href: string) => void): void {
  doc.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a[href]');
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) open(href);
  });
}

/** The real opener: a new tab, no opener, no referrer. */
export const openInNewTab = (href: string): void => {
  window.open(href, '_blank', 'noopener,noreferrer');
};
