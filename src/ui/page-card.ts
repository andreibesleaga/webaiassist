// SPDX-License-Identifier: Apache-2.0
// Draws the page card: the page title, the node badge, the AI-policy line, the chips and
// facts of what the site publishes, and the page's WebMCP tools with what each does. All of
// it comes from the page or the site, so every value is set as text, cut, and shown with
// hidden characters made visible. The status line and the Allow button are page-status.ts.
import type { SiteFacts } from '../core/site-facts';
import { countEffects, visible, type ToolRow } from '../core/tool-card';
import { byId, element } from './dom';
import { t } from './i18n';
import { accessBadge, siteName, type PageStatus } from './page-status';
import { chipLabel, factLines, policyLines } from './site-fact-lines';
import { chipTitleFor, peerHosts } from './site-fact-lines-p2';
import type { RunByHand } from './tool-detail';
import { openRows, toolItem } from './tool-item';

export interface CardView {
  readonly title?: string;
  readonly tools: readonly ToolRow[];
  readonly facts?: SiteFacts;
  /** The files of the site are being read. */
  readonly looking: boolean;
  readonly node: boolean;
  /** The site asks for no AI input and the user has not overridden it. */
  readonly blocked: boolean;
  readonly overridden: boolean;
  /** The "use anyway" button is offered (not for a remote model). */
  readonly canOverride: boolean;
  /** Runs a tool by hand from its detail view (panel-manual-run.ts); absent: no such box. */
  readonly run?: RunByHand;
}

const TITLE_CAP = 200;

function renderTools(doc: Document, rows: readonly ToolRow[], run?: RunByHand): void {
  const toggle = byId<HTMLButtonElement>(doc, 'tools-toggle');
  const list = byId(doc, 'tools-rows');
  const open = openRows(list);
  list.replaceChildren(...rows.map((row) => toolItem(doc, row, run, open)));
  toggle.hidden = rows.length === 0;
  if (rows.length === 0) byId(doc, 'tools-list').hidden = true;
  const { reads, changes } = countEffects(rows);
  toggle.textContent = t('toolsToggle', { count: rows.length, reads, changes });
}

/** "Graph: N items": one button in the chips row that opens the explorer tab (set as text). */
function graphChip(doc: Document, facts: SiteFacts | undefined): HTMLLIElement[] {
  const items = facts?.graphItems;
  if (items === undefined) return [];
  const item = element(doc, 'li', undefined, 'chip');
  item.dataset.chip = 'graph';
  const parts = Object.entries(facts?.node?.counts ?? {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${visible(name)} ${count}`)
    .join(', ');
  const button = element(
    doc,
    'button',
    t(items === 1 ? 'graphChipOne' : 'graphChip', { count: items }),
  );
  button.type = 'button';
  button.id = 'open-graph';
  button.className = 'link';
  button.title = t('graphChipTitle', { parts });
  item.append(button);
  return [item];
}

function renderChips(doc: Document, facts: SiteFacts | undefined): void {
  const chips = (facts?.chips ?? []).map((chip) => {
    const item = element(doc, 'li', chipLabel(chip.id), 'chip');
    item.title = chipTitleFor(chip, facts) ?? t('chipTitle', { path: chip.path });
    item.dataset.chip = chip.id;
    if (chip.id === 'ai-policy' && facts?.aiInput === 'blocked') item.classList.add('warn');
    return item;
  });
  const peers = peerHosts(facts).map((host) => {
    const item = element(doc, 'li', t('chipPeer', { host }), 'chip');
    item.title = t('chipPeerTitle');
    item.dataset.chip = 'peer';
    return item;
  });
  byId(doc, 'site-chips').replaceChildren(...chips, ...peers, ...graphChip(doc, facts));
}

function renderPolicy(doc: Document, view: CardView): void {
  const line = byId(doc, 'site-ai');
  const lines = view.facts ? policyLines(view.facts, view.overridden) : [];
  line.hidden = lines.length === 0;
  line.textContent = lines.join(' ');
  byId<HTMLButtonElement>(doc, 'use-anyway').hidden = !(view.blocked && view.canOverride);
}

/** The site name and the access badge at the top of the card. */
export function renderAccess(doc: Document, status: PageStatus): void {
  byId(doc, 'page-card-title').textContent = siteName(status);
  const badge = accessBadge(status);
  const badgeElement = byId(doc, 'access-badge');
  badgeElement.textContent = t(badge.key);
  badgeElement.className = `badge ${badge.tone}`;
}

/** Redraws everything the card shows besides the status line. */
export function renderCard(doc: Document, view: CardView): void {
  const title = byId(doc, 'page-title');
  title.textContent =
    view.title === undefined ? '' : visible(view.title || t('noTitle')).slice(0, TITLE_CAP);
  title.title = view.title === undefined ? '' : visible(view.title);
  byId(doc, 'node-badge').hidden = !view.node;
  byId(doc, 'site-looking').hidden = !view.looking;
  renderPolicy(doc, view);
  renderChips(doc, view.facts);
  const lines = view.facts ? factLines(view.facts) : [];
  byId(doc, 'site-facts-list').replaceChildren(...lines.map((line) => element(doc, 'li', line)));
  renderTools(doc, view.tools, view.run);
  const read = byId<HTMLButtonElement>(doc, 'read-page');
  read.hidden = view.blocked;
  // With no tools, reading the page is the main way in; with tools it is the second choice.
  read.classList.toggle('primary', view.tools.length === 0);
}

/** Wires the Tools button: it opens and closes the list. */
export function bindToolsToggle(doc: Document): void {
  const toggle = byId<HTMLButtonElement>(doc, 'tools-toggle');
  toggle.addEventListener('click', () => {
    const list = byId(doc, 'tools-list');
    list.hidden = !list.hidden;
    toggle.setAttribute('aria-expanded', String(!list.hidden));
  });
}
