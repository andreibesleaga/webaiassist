// SPDX-License-Identifier: Apache-2.0
// The Graph tab. The explorer itself is the site's own code (third_party/agsc-explorer), already
// in the page; this part adds what WebAIAssist owns around it: a plain note when the node has no
// graph it may read, and the block that lists the node's peers (peers-block.ts). The site's code
// starts by itself and reads through the guarded fetch (src/adapters/graph-fetch-shim.ts).
import { isAllowedPeerOrigin, peerChoices } from '../../adapters/peers';
import { STANDARD_GRAPH_PATH } from '../../core/graph-files';
import { AGSC_PROFILE, namesProfile, parseLinkset, type Linkset } from '../../core/site-linkset';
import { byId, element } from '../dom';
import { t } from '../i18n';
import { renderPeersBlock } from './peers-block';
import type { ExplorerContext, ExplorerTab } from './tabs';

async function readLinkset(ctx: ExplorerContext): Promise<Linkset | undefined> {
  const outcome = await ctx.readTab('linkset').catch(() => undefined);
  if (outcome?.state !== 'found') return undefined;
  const profile = namesProfile(AGSC_PROFILE, outcome.contentType, outcome.link);
  const parsed = parseLinkset(outcome.text, ctx.target.origin, profile);
  return parsed.ok && parsed.linkset.profile ? parsed.linkset : undefined;
}

/** Makes the explorer read the peers that were ticked: its own "Peers" box does the loading. */
function readTicked(ctx: ExplorerContext, origins: string[]): void {
  ctx.approved.clear();
  for (const origin of origins) {
    const check = isAllowedPeerOrigin(origin);
    if (check.ok) ctx.approved.add(check.origin);
  }
  const box = ctx.doc.getElementById('gx-depth');
  if (!(box instanceof HTMLInputElement)) return;
  box.checked = true;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

function note(ctx: ExplorerContext, text: string): void {
  const line = byId(ctx.doc, 'graph-note');
  line.textContent = text;
  line.hidden = text === '';
}

async function mount(root: HTMLElement, ctx: ExplorerContext): Promise<void> {
  const linkset = await readLinkset(ctx);
  if (!linkset) return note(ctx, t('explorerNotANode'));
  if (
    linkset.graphHref !== undefined &&
    new URL(linkset.graphHref).pathname !== STANDARD_GRAPH_PATH
  ) {
    note(ctx, t('explorerNotStandard'));
  }
  const choices = peerChoices(linkset.links, ctx.target.origin);
  if (choices.length === 0) return;
  const block = renderPeersBlock(ctx.doc, choices, (origins) => readTicked(ctx, origins));
  const place = element(ctx.doc, 'div', undefined, 'peers-place');
  place.append(block);
  root.prepend(place);
}

export const graphTab: ExplorerTab = {
  id: 'graph',
  labelKey: 'explorerTabGraph',
  mount: (root, ctx) => void mount(root, ctx),
};
