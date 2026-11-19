// SPDX-License-Identifier: Apache-2.0
// The 4,096-token window of every listed model: the request the loop builds for the live
// AgenticSystemCore node (rules, hint, its ten tools, the site files it published, the
// question) leaves room for the reply. Tokens are counted with the loop's own estimate
// (src/core/history.ts), which counts three Latin characters as one token and so errs high;
// the processor model's real counts come from `npm run eval:cpu` (docs/EVAL.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CPU_CAPABILITIES, CPU_MODELS } from '../../src/adapters/cpu-models';
import { WEBLLM_MODEL_IDS } from '../../src/adapters/models';
import { runAgent } from '../../src/core/agent-loop';
import { estimateTokens, REPLY_RESERVE_TOKENS, usableContext } from '../../src/core/history';
import type { ModelCapabilities } from '../../src/core/ports/model-runtime';
import { siteContext, siteContextLimit } from '../../src/core/site-context';
import { buildSiteFacts, type SiteFacts } from '../../src/core/site-facts';
import type { FileOutcome } from '../../src/core/site-files';
import { AGSC_PROFILE, type Linkset } from '../../src/core/site-linkset';
import { answer, makeDeps } from '../helpers';

const ORIGIN = 'https://agenticsystemcore.com';
const fixture = (name: string): string => readFileSync(`fixtures/site-files/${name}`, 'utf8');
const found = (text: string, contentType = 'text/plain'): FileOutcome => ({
  state: 'found',
  text,
  cut: false,
  link: '',
  contentType,
});

/** What the panel passes for the live node: its linkset and its llms.txt, as read from the site. */
function liveSiteContext(limit?: number): string {
  const facts = buildSiteFacts({
    origin: ORIGIN,
    pagePath: '/',
    nowMs: Date.parse('2026-11-14T00:00:00Z'),
    outcomes: {
      linkset: found(
        fixture('agsc-linkset.json'),
        `application/linkset+json; profile="${AGSC_PROFILE}"`,
      ),
      llms: found(fixture('agsc-llms.txt')),
    },
  });
  return siteContext(facts, limit) ?? '';
}

const words = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

/** A site whose published files fill every piece of the site context to its cap. */
function fullSiteFacts(): SiteFacts {
  const base = buildSiteFacts({
    origin: ORIGIN,
    pagePath: '/',
    nowMs: Date.parse('2026-11-14T00:00:00Z'),
    outcomes: {
      linkset: found(
        fixture('agsc-linkset.json'),
        `application/linkset+json; profile="${AGSC_PROFILE}"`,
      ),
    },
  });
  const node = base.node as Linkset;
  const links = Array.from({ length: 30 }, (_, i) => ({
    rel: 'item',
    href: `${ORIGIN}/items/${i}/`,
    title: `Item ${i} ${words(8)}`,
    sameOrigin: true,
  }));
  return {
    ...base,
    node: { ...node, links },
    catalog: { ...node, links },
    llms: {
      title: 'A site',
      summary: words(400),
      provenance: {},
      sections: Array.from({ length: 20 }, (_, i) => ({
        name: `Section ${i}`,
        links: Array.from({ length: 10 }, (_, j) => ({ text: `Link ${i} ${j} ${words(6)}` })),
      })),
      linkCount: 200,
    },
    agentCard: {
      name: 'Card',
      description: words(300),
      skills: Array.from({ length: 10 }, (_, i) => `skill ${i} ${words(10)}`),
    },
    page: { source: 'JSON-LD', type: 'Article', title: words(40), description: words(300) },
  };
}

/** The runtime of each listed model, as the loop sees it: same window for every model of a runtime. */
const WINDOWS: readonly (readonly [string, ModelCapabilities])[] = [
  ...WEBLLM_MODEL_IDS.map((id) => [`${id} on the graphics card`, CPU_CAPABILITIES] as const),
  ...CPU_MODELS.map((m) => [`${m.id} on the processor`, CPU_CAPABILITIES] as const),
];

async function firstRequestTokens(
  capabilities: ModelCapabilities,
  context: string = liveSiteContext(),
): Promise<number> {
  const deps = makeDeps([answer('ok')]);
  deps.model.capabilities = () => capabilities;
  await runAgent(deps, {
    tabId: 1,
    origin: ORIGIN,
    userText: 'Find the item about sustainability and tell me what it links to.',
    node: true,
    siteContext: context,
  });
  const messages = deps.model.requests[0]?.messages ?? [];
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

describe('the 4096-token window', () => {
  it.each(WINDOWS)('%s: every listed model has the window the loop assumes', (_name, caps) => {
    expect(caps.contextTokens).toBe(4096);
  });

  it.each(WINDOWS)(
    '%s: the node request and the reply reserve fit, with room for a tool result',
    async (_name, caps) => {
      const request = await firstRequestTokens(caps);
      const room = usableContext(caps) - REPLY_RESERVE_TOKENS - request;
      expect(request).toBeLessThanOrEqual(usableContext(caps) - REPLY_RESERVE_TOKENS);
      expect(room).toBeGreaterThanOrEqual(1000);
    },
  );
});

describe('a site that fills every piece of site context to its cap', () => {
  const facts = fullSiteFacts();

  it.each(WINDOWS)(
    '%s: with the limit for this window the request fits and leaves room for a result',
    async (_name, caps) => {
      const context = siteContext(facts, siteContextLimit(caps)) ?? '';
      const request = await firstRequestTokens(caps, context);
      expect(request).toBeLessThanOrEqual(usableContext(caps) - REPLY_RESERVE_TOKENS);
      expect(usableContext(caps) - REPLY_RESERVE_TOKENS - request).toBeGreaterThanOrEqual(1000);
    },
  );

  it('is the case that the old limit (12000 characters) did not fit in 4096 tokens', async () => {
    const request = await firstRequestTokens(CPU_CAPABILITIES, siteContext(facts) ?? '');
    expect(request).toBeGreaterThan(usableContext(CPU_CAPABILITIES) - REPLY_RESERVE_TOKENS - 1000);
  });
});
