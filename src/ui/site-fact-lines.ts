// SPDX-License-Identifier: Apache-2.0
// The short labelled facts the card shows about a site, and the label of each chip. Every value
// came from the site: it is cut, hidden characters are made visible, and it is set as text.
import { visible } from '../core/tool-card';
import type { ChipId, SiteFacts } from '../core/site-facts';
import { t } from './i18n';
import type { MessageKey } from './messages-en';

const CHIP_KEYS: Readonly<Record<ChipId, MessageKey>> = {
  linkset: 'chipLinkset',
  llms: 'chipLlms',
  'llms-full': 'chipLlmsFull',
  'api-catalog': 'chipApiCatalog',
  'agent-card': 'chipAgentCard',
  security: 'chipSecurity',
  robots: 'chipAiPolicy',
  tdmrep: 'chipAiPolicy',
  'ai-policy': 'chipAiPolicy',
  'structured-data': 'chipStructured',
};

export const chipLabel = (id: ChipId): string => t(CHIP_KEYS[id]);

const shown = (text: string, limit = 160): string => visible(text).slice(0, limit);

function nodeLines(facts: SiteFacts): string[] {
  const node = facts.node;
  if (!node) return [];
  const version = node.specVersion;
  const lines = [
    version === undefined ? t('factNodeNoVersion') : t('factNode', { version: shown(version, 20) }),
  ];
  const own = node.links.filter((link) => link.sameOrigin);
  const names = [...new Set(own.map((link) => link.rel))].slice(0, 12);
  if (names.length > 0)
    lines.push(t('factKnowledge', { names: names.map((n) => shown(n, 30)).join(', ') }));
  const peers = node.links.filter((link) => !link.sameOrigin && link.rel === 'peer').length;
  if (peers > 0) lines.push(t('factPeers', { count: peers }));
  if (node.restricted) lines.push(t('factNodeRestricted'));
  if (node.tombstone) lines.push(t('factNodeGone'));
  return lines;
}

function guideLines(facts: SiteFacts): string[] {
  const lines: string[] = [];
  if (facts.llms) {
    const { title, linkCount, sections } = facts.llms;
    lines.push(
      t('factGuide', { title: shown(title, 80), links: linkCount, sections: sections.length }),
    );
  }
  if (facts.llmsFullBytes !== undefined) {
    lines.push(t('factGuideFull', { size: Math.max(1, Math.round(facts.llmsFullBytes / 1024)) }));
  }
  return lines;
}

function otherLines(facts: SiteFacts): string[] {
  const lines: string[] = [];
  const { catalog, agentCard, security, page } = facts;
  if (catalog)
    lines.push(t('factCatalog', { count: catalog.links.filter((l) => l.rel === 'item').length }));
  if (agentCard)
    lines.push(t('factCard', { name: shown(agentCard.name, 80), count: agentCard.skills.length }));
  if (security) {
    const key = security.expired === true ? 'factSecurityExpired' : 'factSecurity';
    lines.push(t(key, { contact: shown(security.contacts[0] ?? '', 120) }));
  }
  if (page) {
    const text = [page.type, page.title ?? page.description].filter(Boolean).join(': ');
    lines.push(t('factPage', { source: page.source, text: shown(text, 140) }));
  }
  return lines;
}

/** The facts, one short line each (the AI policy has its own lines in the card). */
export function factLines(facts: SiteFacts): string[] {
  return [...nodeLines(facts), ...guideLines(facts), ...otherLines(facts)];
}

/** The AI-policy line: what the site says about AI input, and a reserved-rights note. */
export function policyLines(facts: SiteFacts, overridden: boolean): string[] {
  const states: Record<SiteFacts['aiInput'], MessageKey> = {
    allowed: 'aiAllowed',
    blocked: overridden ? 'aiOverridden' : 'aiBlocked',
    'not-stated': 'aiNotStated',
    unreadable: 'aiUnreadable',
  };
  const lines = [t(states[facts.aiInput])];
  if (facts.aiInput === 'blocked' && !overridden) lines.push(t('aiBlockedHelp'));
  if (facts.trainingReserved) lines.push(t('aiTraining'));
  return lines;
}
