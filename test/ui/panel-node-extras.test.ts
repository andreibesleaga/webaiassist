// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Package P2 in the panel: the node's own list of digests, the dashboard lines, the page's link
// rows, the sustainability file, robots.txt signals, starter prompts and peer chips.
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byId, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, FakeSite } from './panel-fakes';
import { AGSC_TOOLS } from '../helpers';
import { chips, fakeClock, fixture, found, nodeOutcomes, open, text } from './site-helpers';

const sha = (value: string): string => createHash('sha256').update(value).digest('base64');
const facts = (): string => byId('site-facts-list').textContent ?? '';

function llmsWith(sha256: string) {
  const outcomes = nodeOutcomes();
  const llms = outcomes.llms;
  if (llms?.state === 'found') outcomes.llms = { ...llms, sha256 };
  return outcomes;
}

async function openNode(site: FakeSite, tools = AGSC_TOOLS): Promise<void> {
  await open(fakeDeps([], { site, bridge: new FakePanelBridge(tools) }));
}

beforeEach(() => {
  loadPage('sidepanel.html');
  fakeClock();
});
afterEach(() => vi.useRealTimers());

describe('the node check against its own list of digests', () => {
  it('shows the chip "matches the node\'s own list" with the bundle version and date', async () => {
    const site = new FakeSite();
    site.outcomes = llmsWith(sha(fixture('agsc-llms.txt')));
    await openNode(site);
    expect(chips()).toContain("matches the node's own list");
    const chip = byId('site-chips').querySelector('[data-chip="digest-match"]');
    expect(chip?.getAttribute('title')).toContain('v1.1.0+1.g97e7002ca39b');
    expect(chip?.getAttribute('title')).toContain('2026-11-13T09:14:46Z');
    expect(chip?.getAttribute('title')).toContain('not who wrote');
    expect(chips().join(' ')).not.toMatch(/trusted|verified/i);
  });

  it('marks a file that differs and keeps its text from the model', async () => {
    const site = new FakeSite();
    site.outcomes = llmsWith(sha('something else'));
    await openNode(site);
    expect(chips()).not.toContain("matches the node's own list");
    expect(chips()).not.toContain('llms.txt');
    expect(facts()).toContain("llms.txt does not match the node's own list");
    expect(facts()).toContain('not given to the model');
  });

  it('shows no chip when nothing could be compared', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    await openNode(site);
    expect(chips()).not.toContain("matches the node's own list");
  });
});

describe('the node dashboard lines', () => {
  it('shows bundle, hash, date, counts and ledger head as text', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    await openNode(site);
    expect(facts()).toContain('Bundle v1.1.0+1.g97e7002ca39b, generated 2026-11-13T09:14:46Z');
    expect(facts()).toContain('sha-256=:62rfshl6x1jrdqJBYGy5rENl/vUhrkw1LCxHCqeEvgg=:');
    expect(facts()).toContain('Items: clusters=3, concepts=13');
    expect(facts()).toContain(
      'Ledger head: 69c4bb61f704658515a4c79404bca0b119456c45bcc56de90415784c545d6923',
    );
  });
});

describe('the page link rows, JSON-LD, sustainability and robots.txt', () => {
  it('shows the same-origin link rows of the page as text', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    site.meta = {
      title: 'T',
      og: {},
      jsonLd: [],
      links: [
        { rel: 'license', href: 'https://node.example/legal/' },
        { rel: 'alternate', href: 'https://other.example/feed' },
      ],
    };
    await openNode(site);
    expect(facts()).toContain('Links the page declares: license /legal/');
    expect(facts()).not.toContain('other.example');
  });

  it('shows a Dataset with its distributions, licence, creator and date', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    site.meta = {
      title: 'T',
      og: {},
      links: [],
      jsonLd: [
        JSON.stringify({
          '@type': 'Dataset',
          name: 'Patterns',
          license: 'https://example.org/l',
          creator: { name: 'A. Writer' },
          dateModified: '2026-11-01',
          distribution: [{}, {}, {}],
        }),
      ],
    };
    await openNode(site);
    expect(facts()).toContain('3 distributions');
    expect(facts()).toContain('licence https://example.org/l');
    expect(facts()).toContain('by A. Writer');
  });

  it('shows the main values of the sustainability file and the signature as present only', async () => {
    const site = new FakeSite();
    site.outcomes = {
      ...nodeOutcomes(),
      sustainability: found(
        fixture('agsc-sustainability-data.json'),
        'application/sustainability-data+json',
      ),
    };
    await openNode(site);
    expect(chips()).toContain('sustainability data');
    expect(facts()).toContain('0.116 kWh');
    expect(facts()).toContain('57.4 gCO2e');
    expect(facts()).toContain('2026-10-01');
    expect(facts()).toContain('signature present');
    expect(facts()).not.toContain('eyJ');
  });

  it('shows every Content-Signal group of robots.txt', async () => {
    const site = new FakeSite();
    site.outcomes = {
      ...nodeOutcomes(),
      robots: found(
        'User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n\nUser-agent: GPTBot\nContent-Signal: ai-train=no\n',
      ),
    };
    await openNode(site);
    expect(facts()).toContain('robots.txt, *: search yes, ai-input yes, ai-train no');
    expect(facts()).toContain('robots.txt, GPTBot: ai-train no');
    expect(text('site-ai')).toContain('the site allows AI input');
  });
});

describe('starter prompts and peer chips on a node', () => {
  const starters = (): string[] =>
    [...byId('starter-prompts').querySelectorAll('button')].map((b) => b.textContent ?? '');

  it('shows three prompts in the empty chat; a click fills the box and sends nothing', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    const bridge = new FakePanelBridge(AGSC_TOOLS);
    await open(fakeDeps([], { site, bridge }));
    expect(starters()).toHaveLength(3);
    expect(byId('starter-prompts').hidden).toBe(false);
    byId('starter-prompts').querySelector('button')?.click();
    expect(byId<HTMLTextAreaElement>('question').value).toBe(starters()[0]);
    expect(byId('transcript').children).toHaveLength(0);
    expect(bridge.calls ?? []).toEqual([]);
  });

  it('offers only the prompts whose tool the page has, and none on a page that is no node', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    await openNode(
      site,
      AGSC_TOOLS.filter((tool) => tool.name !== 'explain'),
    );
    expect(starters()).toHaveLength(2);
    loadPage('sidepanel.html');
    const plain = new FakeSite();
    await open(fakeDeps([], { site: plain, bridge: new FakePanelBridge([]) }));
    expect(byId('starter-prompts').hidden).toBe(true);
  });

  it('shows the declared peer as a text chip and fetches nothing from it', async () => {
    const site = new FakeSite();
    site.outcomes = nodeOutcomes();
    await openNode(site);
    expect(chips()).toContain('peer: patterns.agenticsystemcore.com');
    expect(site.fileCalls.every((call) => !call.origin.includes('patterns'))).toBe(true);
    const peer = byId('site-chips').querySelector('[data-chip="peer"]');
    expect(peer?.tagName).toBe('LI');
    expect(peer?.querySelector('a, button')).toBeNull();
  });
});
