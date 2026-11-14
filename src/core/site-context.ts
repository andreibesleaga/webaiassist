// SPDX-License-Identifier: Apache-2.0
// The "site facts" the model may be given: a few short pieces taken from what the site
// published, each fenced as untrusted data (untrusted.ts) with the origin and the file it came
// from. It goes into the question as page data, never into the system prompt, the tool list or
// the confirmation gate. Never included: robots.txt, security.txt, digests, any address as an
// instruction. Chosen to carry the site's own words only up to a cap.
import type { Linkset } from './site-linkset';
import type { SiteFacts } from './site-facts';
import { wrapUntrusted } from './untrusted';

/** All site pieces of one question together, in characters. */
export const SITE_CONTEXT_CAP = 12000;
/** For a compact prompt (Chrome's built-in model). */
const COMPACT_CAP = 1500;
/**
 * For a window of 4096 tokens or less. The rest of a node request is about 1,650 estimated
 * tokens (rules, node hint, ten tools, the question); with the reply reserve and the 1,000
 * tokens kept for a tool result, the site text may take about 900 tokens, 2,400 characters.
 */
const SMALL_WINDOW_CAP = 2400;
const SMALL_WINDOW_TOKENS = 4096;
const PIECE_CAP = 4000;

/** How many characters of site text one question may carry on this runtime. */
export function siteContextLimit(capabilities: {
  readonly contextTokens: number;
  readonly compactPrompt?: boolean;
}): number {
  if (capabilities.compactPrompt === true) return COMPACT_CAP;
  return capabilities.contextTokens <= SMALL_WINDOW_TOKENS ? SMALL_WINDOW_CAP : SITE_CONTEXT_CAP;
}

interface Piece {
  readonly path: string;
  readonly text: string;
  readonly cap: number;
}

function pathOf(origin: string, href: string): string {
  return href.startsWith(origin) ? href.slice(origin.length) || '/' : href;
}

function linksetPiece(set: Linkset, origin: string): Piece {
  const rows = set.links
    .filter((link) => link.sameOrigin)
    .slice(0, 20)
    .map((link) => {
      const label = link.surface ?? link.type ?? link.title ?? '';
      return `- ${link.rel} ${pathOf(origin, link.href)} ${label}`.trim();
    });
  const version = set.specVersion === undefined ? '' : ` (specification ${set.specVersion})`;
  const text = `Knowledge links of this node${version}:\n${rows.join('\n')}`;
  return { path: '/.well-known/knowledge-linkset', text, cap: 1500 };
}

function llmsPiece(facts: SiteFacts): Piece | undefined {
  const llms = facts.llms;
  if (!llms) return undefined;
  const sections = llms.sections.map(
    (section) => `- ${section.name}: ${section.links.map((link) => link.text).join(', ')}`,
  );
  const summary = llms.summary === undefined ? '' : `\nSummary: ${llms.summary}`;
  return {
    path: '/llms.txt',
    text: `Site guide: ${llms.title}${summary}\nSections:\n${sections.join('\n')}`,
    cap: PIECE_CAP,
  };
}

function catalogPiece(set: Linkset, origin: string): Piece {
  const rows = set.links
    .filter((link) => link.rel === 'item')
    .slice(0, 20)
    .map((link) => `- ${link.title ?? pathOf(origin, link.href)}`);
  return {
    path: '/.well-known/api-catalog',
    text: `APIs the site lists:\n${rows.join('\n')}`,
    cap: 1500,
  };
}

function cardPiece(facts: SiteFacts): Piece | undefined {
  const card = facts.agentCard;
  if (!card) return undefined;
  const lines = [
    `Agent card: ${card.name}`,
    card.description ?? '',
    `Skills: ${card.skills.join(', ')}`,
  ];
  return { path: '/.well-known/agent-card.json', text: lines.filter(Boolean).join('\n'), cap: 800 };
}

function pagePiece(facts: SiteFacts): Piece | undefined {
  const page = facts.page;
  if (!page) return undefined;
  const lines = [page.type, page.title, page.description, page.date].filter(Boolean);
  return { path: `this page (${page.source})`, text: lines.join('\n'), cap: 600 };
}

function pieces(facts: SiteFacts): Piece[] {
  const { origin } = facts;
  const list = [
    facts.node && linksetPiece(facts.node, origin),
    llmsPiece(facts),
    facts.catalog && catalogPiece(facts.catalog, origin),
    cardPiece(facts),
    pagePiece(facts),
  ];
  return list.filter((piece): piece is Piece => !!piece);
}

/** The fenced pieces as one text, or undefined when the site gave nothing to pass on. */
export function siteContext(
  facts: SiteFacts,
  limit: number = SITE_CONTEXT_CAP,
): string | undefined {
  const blocks: string[] = [];
  let left = limit;
  for (const piece of pieces(facts)) {
    if (left <= 0) break;
    const text = `Published by ${facts.origin} in ${piece.path}:\n${piece.text}`;
    const block = wrapUntrusted(`site-file:${piece.path}`, text, Math.min(piece.cap, left));
    blocks.push(block);
    left -= block.length;
  }
  return blocks.length === 0 ? undefined : blocks.join('\n');
}
