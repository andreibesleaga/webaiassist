// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Package P7d in the panel: the node card, the new starter questions, the two first-run help
// screens, and the developer "Copy report".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import { byId, click, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, FakeSite, ORIGIN } from './panel-fakes';
import { AGSC_TOOLS } from '../helpers';
import { fakeClock, flush, nodeOutcomes, open, text } from './site-helpers';
import { DEMO_ADDRESS, START_NODE_COMMAND } from '../../src/ui/node-card';

const starters = (): string[] =>
  [...byId('starter-prompts').querySelectorAll('button')].map((b) => b.textContent ?? '');
const heading = (id: string): string => byId(id).querySelector('h3')?.textContent ?? '';

async function openNode(tools = AGSC_TOOLS) {
  const site = new FakeSite();
  site.outcomes = nodeOutcomes();
  const deps = fakeDeps([], { site, bridge: new FakePanelBridge(tools) });
  await open(deps);
  return deps;
}

beforeEach(() => {
  loadPage('sidepanel.html');
  fakeClock();
});
afterEach(() => vi.useRealTimers());

describe('the node card', () => {
  it('reads "AgenticSystemCore node, spec <version>" from the node\'s own link set', async () => {
    await openNode();
    expect(byId('node-card').hidden).toBe(false);
    expect(heading('node-card')).toBe('AgenticSystemCore node, spec 1.1.0');
    expect(text('node-card')).not.toMatch(/conformance level/);
  });

  it('is hidden on a page that is no node', async () => {
    await open(fakeDeps([], { site: new FakeSite(), bridge: new FakePanelBridge([]) }));
    expect(byId('node-card').hidden).toBe(true);
  });

  it('shows the start command as text with a Copy button and links only to the demo address', async () => {
    const deps = await openNode();
    expect(byId('start-node-command').textContent).toBe(START_NODE_COMMAND);
    expect(START_NODE_COMMAND).toContain('npm install agentic-system-core');
    expect(START_NODE_COMMAND).toContain('agsc init');
    click('start-node-copy');
    await flush();
    expect(deps.copied).toEqual([START_NODE_COMMAND]);
    const hrefs = [...byId('node-card').querySelectorAll('a')].map((a) => a.href);
    expect(hrefs).toEqual(['https://agenticsystemcore.com/']);
    expect(DEMO_ADDRESS).toBe('https://agenticsystemcore.com/');
  });
});

describe('starter questions', () => {
  it('adds "Compose a harness for my task" only when the page has the compose tool', async () => {
    await openNode();
    expect(starters()).toContain('Compose a harness for my task');
    loadPage('sidepanel.html');
    await openNode(AGSC_TOOLS.filter((tool) => tool.name !== 'compose'));
    expect(starters()).not.toContain('Compose a harness for my task');
  });

  it('asks the explain starter about why two items are linked', async () => {
    await openNode();
    const explain = starters().find((s) => /^Explain/.test(s)) ?? '';
    expect(explain).toMatch(/why/);
    expect(explain).toMatch(/linked/);
    expect(explain).not.toMatch(/rule code|AGSC-06-08/);
  });
});

describe('first-run help screens', () => {
  it('"This site has no tools" for a page that registers none, with the demo link', async () => {
    const deps = fakeDeps([], { site: new FakeSite(), bridge: new FakePanelBridge([]) });
    deps.bridge.pageResult = { origin: ORIGIN, linkset: false, tools: [], webmcp: true };
    await open(deps);
    expect(byId('help-screen').hidden).toBe(false);
    expect(heading('help-screen')).toBe('This site has no tools');
    expect(byId('help-screen').querySelector('a')?.href).toBe(DEMO_ADDRESS);
    expect(text('help-screen')).toMatch(/still chat with the model/);
  });

  it('"Chrome needs the WebMCP switch" when this browser has no WebMCP', async () => {
    const deps = fakeDeps([], { site: new FakeSite(), bridge: new FakePanelBridge([]) });
    deps.bridge.pageResult = { origin: ORIGIN, linkset: false, tools: [], webmcp: false };
    await open(deps);
    expect(heading('help-screen')).toBe('Chrome needs the WebMCP switch');
    expect(byId('flag-address').textContent).toBe('chrome://flags/#enable-webmcp-testing');
    expect(byId('help-screen').querySelectorAll('ol li')).toHaveLength(3);
    expect(text('help-screen')).toMatch(/restart Chrome/i);
    expect(byId('help-screen').querySelector('a[href^="chrome"]')).toBeNull();
    click('flag-copy');
    await flush();
    expect(deps.copied).toEqual(['chrome://flags/#enable-webmcp-testing']);
  });

  it('is hidden on a page with tools', async () => {
    await openNode();
    expect(byId('help-screen').hidden).toBe(true);
  });
});

describe('Copy report', () => {
  it('previews first, copies on the second click, and holds no page text', async () => {
    const deps = await openNode();
    click('copy-report');
    await flush();
    const shown = byId('report-preview').textContent ?? '';
    expect(byId('report-box').hidden).toBe(false);
    expect(deps.copied).toEqual([]);
    expect(shown).toContain('# WebMCP tool report');
    expect(shown).toContain('`compose`');
    expect(shown).toContain('13 Nov 2026');
    expect(shown).not.toContain(ORIGIN);
    click('copy-report');
    await flush();
    expect(deps.copied).toEqual([shown]);
    expect(byId('report-box').hidden).toBe(true);
  });

  it('says so when no page was read', async () => {
    const deps = fakeDeps([]);
    deps.bridge.pageResult = new PageError('chrome://', undefined, 'restricted');
    await open(deps);
    click('copy-report');
    await flush();
    expect(byId('report-box').hidden).toBe(true);
    expect(text('page-note')).toContain('Open a page');
  });
});
