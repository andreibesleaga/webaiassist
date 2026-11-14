// SPDX-License-Identifier: Apache-2.0
// More short facts of the card: files that differ from the node's own list, the node dashboard,
// the page's own link rows, richer page data, the sustainability file, the robots.txt signals,
// and the peer chips. All from the site: cut, hidden characters made visible, set as text.
import type { ChipId, SiteChip, SiteFacts } from '../core/site-facts';
import type { Linkset } from '../core/site-linkset';
import type { ContentSignal } from '../core/site-robots';
import type { Sustainability } from '../core/site-sustainability';
import { visible } from '../core/tool-card';
import { t } from './i18n';

const shown = (text: string, limit = 160): string => visible(text).slice(0, limit);
const FILE_NAMES: Partial<Record<ChipId, string>> = {
  llms: 'llms.txt',
  'llms-full': 'llms-full.txt',
  'api-catalog': 'api-catalog',
  'agent-card': 'agent-card.json',
  security: 'security.txt',
  sustainability: 'sustainability-data',
};

function dashboardLines(node: Linkset): string[] {
  const lines: string[] = [];
  const parts = [
    node.bundleVersion && shown(node.bundleVersion, 60),
    node.generatedAt && `generated ${shown(node.generatedAt, 30)}`,
    node.bundleHash && `(hash ${shown(node.bundleHash, 80)})`,
  ].filter(Boolean);
  if (parts.length > 0) lines.push(t('factBundle', { parts: parts.join(', ') }));
  if (node.itemCounts)
    lines.push(t('factItems', { counts: node.itemCounts.map((c) => shown(c, 30)).join(', ') }));
  if (node.ledgerHead) lines.push(t('factLedger', { head: shown(node.ledgerHead, 80) }));
  return lines;
}

function signalValues(signal: ContentSignal): string {
  const word = (flag: boolean) => (flag ? 'yes' : 'no');
  const parts: string[] = [];
  if (signal.search !== undefined) parts.push(`search ${word(signal.search)}`);
  if (signal.aiInput !== undefined) parts.push(`ai-input ${word(signal.aiInput)}`);
  if (signal.aiTrain !== undefined) parts.push(`ai-train ${word(signal.aiTrain)}`);
  return parts.join(', ');
}

const MAX_GROUP_LINES = 6;

function signalLines(facts: SiteFacts): string[] {
  const groups = facts.robotsGroups ?? [];
  const lines = groups.slice(0, MAX_GROUP_LINES).map((group) =>
    t('factSignal', {
      agents: group.agents.map((agent) => shown(agent, 40)).join(', '),
      values: signalValues(group.signal) || '-',
    }),
  );
  if (groups.length > MAX_GROUP_LINES)
    lines.push(t('factSignalMore', { count: groups.length - MAX_GROUP_LINES }));
  return lines;
}

function sustainLine(data: Sustainability): string {
  const period =
    data.periodStart && data.periodEnd
      ? `${shown(data.periodStart, 10)} to ${shown(data.periodEnd, 10)}`
      : undefined;
  const values = [data.energy, data.carbon, period, data.method, data.provider]
    .filter((value): value is string => value !== undefined)
    .map((value) => shown(value, 100));
  if (data.signed) values.push(t('factSustainSigned'));
  return t('factSustain', { values: values.join('; ') });
}

function pageLines(facts: SiteFacts): string[] {
  const lines: string[] = [];
  const rows = (facts.pageLinks ?? []).map(
    (row) => `${shown(row.rel, 30)} ${shown(row.path, 100)}`,
  );
  if (rows.length > 0) lines.push(t('factPageLinks', { rows: rows.join(', ') }));
  const page = facts.page;
  const more = [
    page?.distributions !== undefined && t('factPageDistributions', { count: page.distributions }),
    page?.license && t('factPageLicence', { licence: shown(page.license, 100) }),
    page?.creator && t('factPageCreator', { creator: shown(page.creator, 100) }),
    page?.date && shown(page.date, 30),
  ].filter(Boolean);
  if (more.length > 0) lines.push(t('factPageMore', { parts: more.join(', ') }));
  return lines;
}

function digestLines(facts: SiteFacts, chipName: (id: ChipId) => string): string[] {
  return facts.digests.mismatched.map((id) =>
    t('factDigestMismatch', { file: FILE_NAMES[id] ?? chipName(id) }),
  );
}

/** The lines added by package P2, after the others. */
export function extraFactLines(facts: SiteFacts, chipName: (id: ChipId) => string): string[] {
  return [
    ...digestLines(facts, chipName),
    ...(facts.node ? dashboardLines(facts.node) : []),
    ...pageLines(facts),
    ...(facts.sustainability ? [sustainLine(facts.sustainability)] : []),
    ...signalLines(facts),
  ];
}

/** The title of a chip: the digest chip names the bundle; the others say the site published it. */
export function chipTitleFor(chip: SiteChip, facts: SiteFacts | undefined): string | undefined {
  if (chip.id !== 'digest-match' || !facts?.node) return undefined;
  const { bundleVersion, generatedAt } = facts.node;
  return t('chipDigestTitle', {
    version: shown(bundleVersion ?? '?', 60),
    date: shown(generatedAt ?? '?', 30),
  });
}

const MAX_PEERS = 5;

/** The hosts of the peer links of the node (other sites it names), for text chips. */
export function peerHosts(facts: SiteFacts | undefined): string[] {
  const hosts = (facts?.node?.links ?? [])
    .filter((link) => link.rel === 'peer' && !link.sameOrigin)
    .map((link) => /^https?:\/\/([^/?#]+)/i.exec(link.href)?.[1])
    .filter((host): host is string => host !== undefined)
    .map((host) => shown(host, 80));
  return [...new Set(hosts)].slice(0, MAX_PEERS);
}
