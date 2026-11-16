// SPDX-License-Identifier: Apache-2.0
// When the first list of a page is empty, the panel asks again after one and after three
// seconds: a page that registers its tools a moment later, or a browser's first start, would
// otherwise stay at "no tools" until the page changes something (a change notice lists again).

/** Delays (ms) of the second and third look. */
const RELIST_MS = [1_000, 2_000];

/** Plans the next look when the list was empty; `current` says the panel still shows that page. */
export function relistIfEmpty(
  empty: boolean,
  attempt: number,
  current: () => boolean,
  again: (next: number) => Promise<void>,
): void {
  if (!empty || attempt >= RELIST_MS.length) return;
  setTimeout(() => {
    if (current()) void again(attempt + 1);
  }, RELIST_MS[attempt]);
}
