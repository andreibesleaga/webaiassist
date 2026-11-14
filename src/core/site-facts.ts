// SPDX-License-Identifier: Apache-2.0
// Puts the readings of the site files together: the chips the card shows, the short facts, the
// AgenticSystemCore node check and the "no AI input" decision. Everything here came from the
// site and is untrusted; nothing in it adds a tool, changes a setting or names an address to
// fetch. The text for the model is built in site-context.ts.
import { graphItemCount } from './graph-files';
import { isAgscNode } from './node-mode';
import { checkDigests, type DigestCheck } from './site-digest';
import {
  AGSC_PROFILE,
  CATALOG_PROFILE,
  namesProfile,
  parseLinkset,
  type Linkset,
} from './site-linkset';
import { parseLlms, type Llms } from './site-llms';
import {
  pageFact,
  pageLinkRows,
  type PageFact,
  type PageLinkRow,
  type PageMeta,
} from './site-page';
import {
  decideAiInput,
  parseRobots,
  parseRobotsGroups,
  type AiInput,
  type RobotsGroup,
} from './site-robots';
import { parseSustainability, type Sustainability } from './site-sustainability';
import type { FileOutcome, SiteFileId } from './site-files';
import {
  parseAgentCard,
  parseSecurityTxt,
  tdmReserved,
  type AgentCard,
  type SecurityTxt,
} from './site-small';

export type ChipId = SiteFileId | 'ai-policy' | 'structured-data' | 'digest-match';
export type Outcomes = Partial<Record<SiteFileId, FileOutcome>>;

export interface SiteChip {
  readonly id: ChipId;
  /** The path it came from, for the chip's title. */
  readonly path: string;
}

export interface SiteFacts {
  readonly origin: string;
  readonly chips: readonly SiteChip[];
  readonly aiInput: AiInput;
  readonly trainingReserved: boolean;
  readonly llms?: Llms;
  readonly llmsFullBytes?: number;
  /** A valid knowledge link set of this origin with the node profile. */
  readonly node?: Linkset;
  readonly catalog?: Linkset;
  /** The items the node says its graph holds (the sum of its counts); the card offers the explorer. */
  readonly graphItems?: number;
  readonly agentCard?: AgentCard;
  readonly security?: SecurityTxt;
  readonly page?: PageFact;
  /** Package P2, added at the end: digests against the node's own list, the page's link rows,
   *  the sustainability file and every Content-Signal group of robots.txt. */
  readonly digests: DigestCheck;
  readonly pageLinks?: readonly PageLinkRow[];
  readonly sustainability?: Sustainability;
  readonly robotsGroups?: readonly RobotsGroup[];
}

export interface FactsInput {
  readonly origin: string;
  readonly outcomes: Outcomes;
  readonly page?: PageMeta;
  /** The path of the open page, for the TDMRep rule. */
  readonly pagePath: string;
  readonly nowMs: number;
}

const found = (outcome: FileOutcome | undefined) =>
  outcome?.state === 'found' ? outcome : undefined;

function linksetOf(
  outcome: FileOutcome | undefined,
  origin: string,
  profile: string,
): Linkset | undefined {
  const file = found(outcome);
  if (!file) return undefined;
  const result = parseLinkset(
    file.text,
    origin,
    namesProfile(profile, file.contentType, file.link),
  );
  return result.ok ? result.linkset : undefined;
}

function reservedBy(input: FactsInput, aiTrain: boolean | undefined): boolean {
  const tdm = found(input.outcomes.tdmrep);
  const reserved = tdm ? tdmReserved(tdm.text, input.pagePath) : undefined;
  return reserved === true || aiTrain === false || input.page?.tdm === '1';
}

/** At least one listed file was checked and none differs. */
const digestsAllMatch = (facts: Omit<SiteFacts, 'chips'>): boolean =>
  facts.node !== undefined &&
  facts.digests.matched.length > 0 &&
  facts.digests.mismatched.length === 0;

function chips(facts: Omit<SiteFacts, 'chips'>, policyStated: boolean): SiteChip[] {
  const list: { id: ChipId; path: string; on: boolean }[] = [
    { id: 'linkset', path: '/.well-known/knowledge-linkset', on: facts.node !== undefined },
    { id: 'llms', path: '/llms.txt', on: facts.llms !== undefined },
    { id: 'llms-full', path: '/llms-full.txt', on: facts.llmsFullBytes !== undefined },
    { id: 'api-catalog', path: '/.well-known/api-catalog', on: facts.catalog !== undefined },
    { id: 'agent-card', path: '/.well-known/agent-card.json', on: facts.agentCard !== undefined },
    { id: 'security', path: '/.well-known/security.txt', on: facts.security !== undefined },
    { id: 'ai-policy', path: '/robots.txt', on: policyStated },
    { id: 'structured-data', path: 'JSON-LD', on: facts.page?.source === 'JSON-LD' },
    {
      id: 'sustainability',
      path: '/.well-known/sustainability-data',
      on: facts.sustainability !== undefined,
    },
    { id: 'digest-match', path: '/.well-known/knowledge-linkset', on: digestsAllMatch(facts) },
  ];
  return list.filter((item) => item.on).map(({ id, path }) => ({ id, path }));
}

type Parts = Omit<SiteFacts, 'chips' | 'origin' | 'aiInput' | 'trainingReserved' | 'digests'>;

function parts(input: FactsInput): Parts {
  const { outcomes, origin } = input;
  const llmsFile = found(outcomes.llms);
  const cardFile = found(outcomes['agent-card']);
  const security = found(outcomes.security);
  const full = found(outcomes['llms-full']);
  const sustain = found(outcomes.sustainability);
  const node = linksetOf(outcomes.linkset, origin, AGSC_PROFILE);
  const found_ = {
    llms: llmsFile ? parseLlms(llmsFile.text) : undefined,
    llmsFullBytes: full?.text.length,
    node: node?.profile ? node : undefined,
    catalog: linksetOf(outcomes['api-catalog'], origin, CATALOG_PROFILE),
    agentCard: cardFile ? parseAgentCard(cardFile.text) : undefined,
    security: security ? parseSecurityTxt(security.text, origin, input.nowMs) : undefined,
    page: input.page ? pageFact(input.page) : undefined,
    pageLinks: input.page ? nonEmpty(pageLinkRows(input.page, origin)) : undefined,
    sustainability: sustain ? parseSustainability(sustain.text) : undefined,
  };
  return Object.fromEntries(Object.entries(found_).filter(([, value]) => value !== undefined));
}

const nonEmpty = <T>(list: readonly T[]): readonly T[] | undefined =>
  list.length > 0 ? list : undefined;

/** What a file that does not match the node's own list must not leave behind in the facts.
 *  robots.txt and tdmrep.json are never dropped: ignoring a "no AI" statement is the unsafe way. */
const DROPPED: Partial<Record<SiteFileId, keyof Parts>> = {
  llms: 'llms',
  'llms-full': 'llmsFullBytes',
  'api-catalog': 'catalog',
  'agent-card': 'agentCard',
  security: 'security',
  sustainability: 'sustainability',
};

function withoutMismatched(all: Parts, mismatched: readonly SiteFileId[]): Parts {
  const dropped = new Set(mismatched.map((id) => DROPPED[id]));
  return Object.fromEntries(
    Object.entries(all).filter(([key]) => !dropped.has(key as keyof Parts)),
  );
}

/** Everything the card knows about the site, from the outcomes of the file reads. */
export function buildSiteFacts(input: FactsInput): SiteFacts {
  const robots = found(input.outcomes.robots);
  const signal = robots ? parseRobots(robots.text) : {};
  const trainingReserved = reservedBy(input, signal.aiTrain);
  const all = parts(input);
  const digests = all.node
    ? checkDigests(all.node, input.outcomes, input.origin)
    : { matched: [], mismatched: [] };
  const groups = robots ? nonEmpty(parseRobotsGroups(robots.text)) : undefined;
  const graphItems = graphItemCount(all.node?.counts);
  const base = {
    origin: input.origin,
    aiInput: decideAiInput(input.outcomes.robots),
    trainingReserved,
    ...withoutMismatched(all, digests.mismatched),
    digests,
    ...(groups ? { robotsGroups: groups } : {}),
    ...(graphItems === undefined || graphItems === 0 ? {} : { graphItems }),
  };
  const stated = signal.aiInput !== undefined || signal.aiTrain !== undefined || trainingReserved;
  return { ...base, chips: chips(base, stated) };
}

/** The node check: ten known tool names, or a valid knowledge link set once the files were read
 *  (before that, the page's own link to it). */
export function isNodeSite(
  toolNames: readonly string[],
  linksetFlag: boolean,
  facts: SiteFacts | undefined,
): boolean {
  if (isAgscNode({ toolNames })) return true;
  return facts ? facts.node !== undefined : linksetFlag;
}
