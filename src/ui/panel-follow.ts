// SPDX-License-Identifier: Apache-2.0
// Keeps the card on the page in front, by itself: when the user switches tab or window, a page
// finishes loading, the address changes in place (single-page sites), the title changes, or
// the page's tools change. Events are gathered for a short time and give one refresh (a page
// that fires a thousand events in a second causes one); a title change alone only redraws the
// title row. The refresh reads nothing from a site the user has not allowed.
import type { BrowserEvent } from './site-deps';
import type { PanelController } from './panel-controller';
import { refreshPage, refreshTitle } from './panel-page';

/** Events that arrive within this time of each other give one refresh. */
export const QUIET_MS = 250;
/** A page that never stops changing is still read this often. */
export const LONGEST_WAIT_MS = 2000;

type Kind = 'page' | 'title';

/** Gathers calls: `run` is called once, `quiet` ms after the last call and at most `longest` ms
 *  after the first. A page-level request wins over a title-only one. */
export function gather(
  run: (kind: Kind) => void,
  quiet: number = QUIET_MS,
  longest: number = LONGEST_WAIT_MS,
): (kind: Kind) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = 0;
  let kind: Kind | undefined;
  const fire = (): void => {
    const due = kind;
    timer = undefined;
    kind = undefined;
    if (due !== undefined) run(due);
  };
  return (next) => {
    if (kind !== 'page') kind = next;
    const now = Date.now();
    if (timer === undefined) first = now;
    else clearTimeout(timer);
    timer = setTimeout(fire, Math.max(0, Math.min(quiet, first + longest - now)));
  };
}

function kindOf(ctx: PanelController, event: BrowserEvent): Kind | undefined {
  if (event.kind === 'tab-activated' || event.kind === 'window-focus') return 'page';
  if (event.kind === 'access-changed') {
    ctx.state.site = undefined;
    return 'page';
  }
  if (event.tabId !== ctx.state.page?.tabId) return undefined;
  if (event.status === 'complete' || event.url !== undefined) return 'page';
  return event.title === undefined ? undefined : 'title';
}

export function startFollowing(ctx: PanelController): void {
  const request = gather((kind) => {
    void (kind === 'page' ? refreshPage(ctx) : refreshTitle(ctx));
  });
  ctx.deps.bridge.onChange((tabId) => {
    if (tabId === ctx.state.page?.tabId) request('page');
  });
  ctx.deps.site?.events((event) => {
    const kind = kindOf(ctx, event);
    if (kind !== undefined) request(kind);
  });
}
