// SPDX-License-Identifier: Apache-2.0
// The tab list of the explorer page (WAI-ARIA tabs pattern: arrow keys move between the tabs, one
// tab is in the tab order, a tab shows its panel). A tab's panel is the element with id
// `panel-<id>` when the page already has one (the Graph panel holds the site's explorer markup),
// otherwise it is created here. Labels are WebAIAssist's own texts.
import { element } from '../dom';
import { t } from '../i18n';
import type { MessageKey } from '../messages-en';

/** A tab of the list; the context is the page's own (the explorer's, or the Activity-only one). */
export interface ShellTab<C> {
  readonly id: string;
  readonly labelKey: MessageKey;
  mount(root: HTMLElement, ctx: C): void;
}
interface HasDoc {
  readonly doc: Document;
}

function panelFor(ctx: HasDoc, tab: ShellTab<never>, host: HTMLElement): HTMLElement {
  const existing = ctx.doc.getElementById(`panel-${tab.id}`);
  if (existing) return existing;
  const panel = element(ctx.doc, 'div');
  panel.id = `panel-${tab.id}`;
  panel.setAttribute('role', 'tabpanel');
  panel.hidden = true;
  host.append(panel);
  return panel;
}

/** Shows `selected`, hides the other panels, and keeps one tab in the tab order. */
function select(buttons: Map<string, HTMLButtonElement>, selected: string, ctx: HasDoc) {
  for (const [id, button] of buttons) {
    const on = id === selected;
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
    const panel = ctx.doc.getElementById(`panel-${id}`);
    if (panel) panel.hidden = !on;
  }
}

function move(key: string, order: string[], current: string): string | undefined {
  const at = order.indexOf(current);
  const step = { ArrowRight: 1, ArrowLeft: -1 }[key];
  if (key === 'Home') return order[0];
  if (key === 'End') return order.at(-1);
  return step === undefined ? undefined : order[(at + step + order.length) % order.length];
}

/** Builds the tab list in `bar` and mounts each tab into its panel inside `host`. */
export function startShell<C extends HasDoc>(
  ctx: C,
  tabs: readonly ShellTab<C>[],
  bar: HTMLElement,
  host: HTMLElement,
): void {
  const buttons = new Map<string, HTMLButtonElement>();
  const order = tabs.map((tab) => tab.id);
  for (const tab of tabs) {
    const button = element(ctx.doc, 'button', t(tab.labelKey));
    button.type = 'button';
    button.id = `tab-${tab.id}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `panel-${tab.id}`);
    button.addEventListener('click', () => select(buttons, tab.id, ctx));
    button.addEventListener('keydown', (event) => {
      const next = move(event.key, order, tab.id);
      if (next === undefined) return;
      event.preventDefault();
      select(buttons, next, ctx);
      buttons.get(next)?.focus();
    });
    buttons.set(tab.id, button);
    bar.append(button);
    const panel = panelFor(ctx, tab, host);
    panel.setAttribute('aria-labelledby', button.id);
    tab.mount(panel, ctx);
  }
  select(buttons, order[0] ?? '', ctx);
}
