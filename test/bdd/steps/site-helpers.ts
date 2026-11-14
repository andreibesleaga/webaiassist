// SPDX-License-Identifier: Apache-2.0
// Helpers of the steps about what a site publishes and about following the browser: files for
// the test server, a panel that follows the tab in front, the scripted model's requests.
import { expect, type Page } from '@playwright/test';
import { AGSC_PROFILE } from '../../../src/core/site-linkset';
import { openPage, openPanelFor, openStubPage, pageShown, type Route } from '../../smoke/harness';
import type { World } from '../world';

export const SITE_PATHS = [
  '/.well-known/knowledge-linkset',
  '/llms.txt',
  '/robots.txt',
  '/.well-known/tdmrep.json',
  '/.well-known/security.txt',
  '/.well-known/api-catalog',
  '/.well-known/agent-card.json',
  '/llms-full.txt',
];

const LLMS =
  '# Test site\n> A site for tests.\n## Guides\n- [One](https://example.test/one): the first\n';

function linkset(origin: string, extra = ''): string {
  const surface = `{"href":"${origin}/compose/","agsc-surface":["webmcp"]}`;
  const set = {
    anchor: `${origin}/`,
    describedby: [{ href: `${origin}/graph.jsonld`, 'agsc-spec-version': ['1.1.0'] }],
    'https://w3id.org/agentic-system-core/rel#surface': [JSON.parse(surface) as object],
  };
  return JSON.stringify({ linkset: [{ ...set, ...(extra ? JSON.parse(extra) : {}) }] });
}

/** A valid file for each known path, as the site `origin` would publish it. */
export function fileRoute(path: string, origin: string): Route {
  const profile = `application/linkset+json; profile="${AGSC_PROFILE}"`;
  switch (path) {
    case '/.well-known/knowledge-linkset':
      return { type: profile, body: linkset(origin) };
    case '/.well-known/api-catalog':
      return {
        type: 'application/linkset+json',
        body: JSON.stringify({
          linkset: [
            {
              anchor: `${origin}/.well-known/api-catalog`,
              item: [{ href: `${origin}/api`, title: 'Items' }],
            },
          ],
        }),
      };
    case '/.well-known/agent-card.json':
      return { type: 'application/json', body: '{"name":"Helper","skills":[{"name":"search"}]}' };
    case '/.well-known/security.txt':
      return {
        body: `Contact: https://example.test/report\nExpires: 2099-01-01T00:00:00Z\nCanonical: ${origin}/.well-known/security.txt\n`,
      };
    case '/robots.txt':
      return { body: 'User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n' };
    case '/.well-known/tdmrep.json':
      return { type: 'application/json', body: '[{"location":"/","tdm-reservation":1}]' };
    default:
      return { body: LLMS };
  }
}

/** The side panel for the world's page: fixed on it, or following the tab in front. */
export async function openSitePanel(world: World, follow = false): Promise<Page> {
  if (world.tabId === undefined) throw new Error('open a page first');
  const before = async (panel: Page): Promise<void> => {
    await panel.addInitScript(() => {
      (window as unknown as { __scriptedRequests: unknown[] }).__scriptedRequests = [];
      window.alert = () => {
        (window as unknown as { __alerted: boolean }).__alerted = true;
      };
    });
  };
  world.panel = await openPanelFor(await world.session(), world.tabId, before, follow);
  world.focusOn('panel');
  return world.panel;
}

/** Opens the stub page of the site (allowed unless `local`) and the panel. */
export async function openSite(world: World, options: { local?: boolean; follow?: boolean } = {}) {
  const session = await world.session();
  world.notAllowedYet = options.local === true;
  const { page, tabId } = await openStubPage(
    session,
    options.local ? session.localOrigin : session.origin,
  );
  world.page = page;
  world.tabId = tabId;
  world.pages.set('first', { page, tabId, origin: await world.origin() });
  world.hitsBefore = session.site.hits.length;
  return openSitePanel(world, options.follow === true);
}

/** A test page of the harness: its path and the text its #status shows when it is ready. */
export interface PageAt {
  readonly path: string;
  readonly ready: string;
}
export const STUB: PageAt = { path: '/', ready: 'registered 2 tools' };
export const PLAIN: PageAt = { path: '/plain', ready: 'plain page' };

/** Opens a page at `origin` as a new tab (it comes to the front) and remembers it. */
export async function openTab(world: World, name: string, origin: string, at: PageAt) {
  const session = await world.session();
  const { page, tabId } = await openPage(session, origin, at.path, at.ready);
  world.pages.set(name, { page, tabId, origin });
  return { page, tabId };
}

/** Waits until the panel finished reading the site's files. The "looking" line is hidden before
 *  the panel has a page at all, so a page status comes first: from then on the line is shown
 *  until the facts are known. */
export async function siteRead(panel: Page): Promise<void> {
  await pageShown(panel);
  await expect(panel.locator('#site-looking')).toBeHidden({ timeout: 20_000 });
  await expect(panel.locator('#page-status')).not.toContainText('Looking at');
}

export const chipTexts = (panel: Page): Promise<string[]> =>
  panel.locator('#site-chips li').allTextContents();

/** The requests the test server got since the scenario's page was opened. */
export async function hitsSince(world: World) {
  return (await world.session()).site.hits.slice(world.hitsBefore);
}

export async function scriptedReady(world: World): Promise<void> {
  const panel = world.requirePanel();
  await panel.selectOption('#model', 'scripted');
  await panel.click('#start');
  await expect(panel.locator('#model-status')).toHaveText('Ready: Scripted test model.');
}

/** What the scripted model was sent, request by request. */
export async function modelRequests(panel: Page): Promise<{ role: string; content: string }[][]> {
  return panel.evaluate(
    () =>
      (window as unknown as { __scriptedRequests: { role: string; content: string }[][] })
        .__scriptedRequests,
  );
}

/** Asks `text`; allows the site question first, and every tool question, until the answer ends. */
export async function askAndSettle(
  world: World,
  text: string,
  options: { allowTools?: boolean } = {},
) {
  const panel = world.requirePanel();
  await panel.fill('#question', text);
  await panel.press('#question', 'Control+Enter');
  const settled = async (): Promise<boolean> => {
    if (await panel.locator('#confirm-title').isVisible()) {
      const title = (await panel.locator('#confirm-title').textContent()) ?? '';
      const allow = title.startsWith('Use the tools') || options.allowTools === true;
      await panel.click(allow ? '#confirm-allow' : '#confirm-deny');
      return false;
    }
    return (
      (await panel.locator('#send').isEnabled()) &&
      (await panel.locator('#transcript li').count()) > 1
    );
  };
  await expect.poll(settled, { timeout: 30_000, intervals: [100] }).toBe(true);
}

/** Serves `route` (or the valid file for `path`) from the site under test. */
export async function setRoute(world: World, path: string, route?: Route): Promise<void> {
  const session = await world.session();
  session.site.routes.set(path, route ?? fileRoute(path, await world.origin()));
}

/** Opens the site and the panel once, and waits for the panel to finish reading the site. */
export async function ensureSite(world: World): Promise<void> {
  if (!world.panel) await openSite(world);
  await siteRead(world.requirePanel());
}

/** The messages the model got from the site, as tool-role texts of its first request. */
export async function toolMessages(world: World): Promise<string[]> {
  const requests = await modelRequests(world.requirePanel());
  return (requests[0] ?? []).filter((m) => m.role === 'tool').map((m) => m.content);
}
