// SPDX-License-Identifier: Apache-2.0
// Shared set-up of the browser tests: the smoke-test build (dist-smoke/) loaded unpacked in
// Playwright's Chromium with the WebMCP testing feature (chrome://flags/#enable-webmcp-testing),
// and a local page that registers two tools on document.modelContext. The page is served at
// http://127.0.0.1:<port>, which the smoke-test build may always script, and at
// http://localhost:<port>, which it may script only after a toolbar click or a site grant.
// The toolbar click is Chrome DevTools Protocol `Extensions.triggerAction` (needs
// --enable-unsafe-extension-debugging and Playwright's pipe connection). When no browser can
// start, the tests fail with the reason; WEBAIASSIST_ALLOW_NO_BROWSER=1 turns that into a skip
// for a machine without Chromium (never in CI or `npm run verify:release`).
import { chromium, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist-smoke');
const read = (name: string): string =>
  readFileSync(join(process.cwd(), 'test/smoke', name), 'utf8');
/** What the local server serves: the stub page with two tools, a page with none, and a page
 *  whose tool always throws. */
const PAGES: Readonly<Record<string, string>> = {
  '/': read('stub-page.html'),
  '/plain': read('plain-page.html'),
  '/boom': read('boom-page.html'),
  '/node': read('node-page.html'),
  '/poison': read('poison-page.html'),
  '/thirty': read('thirty-page.html'),
};

/** One file the test server answers with (instead of a 404) for a path. */
export interface Route {
  readonly status?: number;
  readonly type?: string;
  readonly body?: string | Buffer;
  readonly headers?: Record<string, string>;
  /** Sends the headers and part of the body, then never finishes. */
  readonly stall?: boolean;
}

/** What the test server does: files for paths, a page that answers 200 for everything, headers
 *  for the HTML pages, and a log of every request it received. */
export interface SiteSetup {
  readonly routes: Map<string, Route>;
  softNotFound: boolean;
  pageHeaders: Record<string, string>;
  readonly hits: { host: string; path: string; cookie: boolean; referer: boolean }[];
}

export interface Session {
  readonly context: BrowserContext;
  readonly worker: Worker;
  readonly server: Server;
  readonly site: SiteSetup;
  /** The same server at http://127.0.0.2:<port>: another site, also allowed in the smoke build. */
  readonly otherOrigin: string;
  readonly origin: string;
  /** The same page at http://localhost:<port>: no access until the user gives it. */
  readonly localOrigin: string;
  readonly extensionId: string;
  close(): Promise<void>;
}

function answer(site: SiteSetup, request: IncomingMessage, response: ServerResponse): void {
  const path = request.url?.split('?')[0] ?? '/';
  site.hits.push({
    host: request.headers.host ?? '',
    path,
    cookie: request.headers.cookie !== undefined,
    referer: request.headers.referer !== undefined,
  });
  const route = site.routes.get(path);
  if (route) return sendRoute(route, response);
  const page = PAGES[path];
  if (page !== undefined) {
    const type = { 'content-type': 'text/html; charset=utf-8', ...site.pageHeaders };
    return void response.writeHead(200, type).end(page);
  }
  if (site.softNotFound) {
    return void response.writeHead(200, { 'content-type': 'text/html' }).end('<p>Not found</p>');
  }
  response.writeHead(404, { 'content-type': 'text/html' }).end('<p>Not found</p>');
}

function sendRoute(route: Route, response: ServerResponse): void {
  const headers = { 'content-type': route.type ?? 'text/plain', ...route.headers };
  response.writeHead(route.status ?? 200, headers);
  if (route.stall) return void response.write('# Stalled\n');
  response.end(route.body ?? '');
}

function listen(site: SiteSetup, host: string): Promise<Server> {
  const server = createServer((request, response) => answer(site, request, response));
  return new Promise((resolve) => server.listen(0, host, () => resolve(server)));
}

async function launch(): Promise<{ context: BrowserContext; worker: Worker }> {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--enable-features=WebMCPTesting',
      '--enable-unsafe-extension-debugging',
    ],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 20_000 }));
  return { context, worker };
}

/** Starts the stub page server and the browser with the extension. */
export async function startSession(): Promise<Session> {
  const site: SiteSetup = { routes: new Map(), softNotFound: false, pageHeaders: {}, hits: [] };
  const server = await listen(site, '127.0.0.1');
  const other = await listen(site, '127.0.0.2');
  let started: { context: BrowserContext; worker: Worker };
  try {
    started = await launch();
  } catch (error) {
    server.close();
    other.close();
    const why =
      error instanceof Error ? (error.message.split('\n')[0] ?? error.name) : String(error);
    if (process.env.WEBAIASSIST_ALLOW_NO_BROWSER === '1') test.skip(true, `no browser: ${why}`);
    throw new Error(`No browser could start (${why}). Run: npx playwright install chromium`);
  }
  const { context, worker } = started;
  const port = (server.address() as AddressInfo).port;
  const otherPort = (other.address() as AddressInfo).port;
  return {
    context,
    worker,
    server,
    site,
    otherOrigin: `http://127.0.0.2:${otherPort}`,
    origin: `http://127.0.0.1:${port}`,
    localOrigin: `http://localhost:${port}`,
    extensionId: new URL(worker.url()).host,
    close: async () => {
      await context.close();
      server.close();
      other.close();
    },
  };
}

/** Opens `path` at `origin`, waits for its #status text, and returns the page with its tab id
 *  (the active tab). */
export async function openPage(
  session: Session,
  origin: string,
  path: string,
  ready: string,
): Promise<{ page: Page; tabId: number }> {
  const page = await session.context.newPage();
  await page.goto(`${origin}${path}`);
  await page.locator('#status').filter({ hasText: ready }).waitFor();
  return activeTab(session, page);
}

/** Opens the stub page at `origin` and returns it with its tab id (the active tab). */
export function openStubPage(
  session: Session,
  origin = session.origin,
): Promise<{ page: Page; tabId: number }> {
  return openPage(session, origin, '/', 'registered 2 tools');
}

/** Opens the page whose one tool, "boom", always throws (the server's /boom). */
export function openBoomPage(
  session: Session,
  origin = session.origin,
): Promise<{ page: Page; tabId: number }> {
  return openPage(session, origin, '/boom', 'registered the failing tool');
}

/** Opens the page without WebMCP tools (the server's /plain). */
export function openPlainPage(
  session: Session,
  origin = session.origin,
): Promise<{ page: Page; tabId: number }> {
  return openPage(session, origin, '/plain', 'plain page');
}

/** Opens the page with a clean tool and one whose description carries a turn marker. */
export function openPoisonPage(
  session: Session,
  origin = session.origin,
): Promise<{ page: Page; tabId: number }> {
  return openPage(session, origin, '/poison', 'registered the poisoned page');
}

/** Opens the page with thirty tools. */
export function openThirtyPage(
  session: Session,
  origin = session.origin,
): Promise<{ page: Page; tabId: number }> {
  return openPage(session, origin, '/thirty', 'registered 30 tools');
}

/** Brings `page` to the front and returns it with its tab id. */
export async function activeTab(
  session: Session,
  page: Page,
): Promise<{ page: Page; tabId: number }> {
  await page.bringToFront();
  const tabId = await session.worker.evaluate(
    async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id,
  );
  if (tabId === undefined) throw new Error('no active tab');
  return { page, tabId };
}

/** The side panel page in a tab, bound to `tabId` (the development build's ?tab=). */
export async function openPanelFor(
  session: Session,
  tabId: number,
  before?: (panel: Page) => Promise<void>,
  follow = false,
): Promise<Page> {
  const panel = await session.context.newPage();
  await before?.(panel);
  // `follow` makes the panel go with the tab the test brings to the front (the dev build only).
  const mode = follow ? '&follow=1' : '';
  await panel.goto(`chrome-extension://${session.extensionId}/sidepanel.html?tab=${tabId}${mode}`);
  // The panel binds its controls once it has started; its first page status says so.
  await pageShown(panel);
  return panel;
}

/** Waits until the panel shows a status for a page. The line is empty until the panel fills in its
 *  texts, then says "No page yet." until the first listing: both come before the page. */
export async function pageShown(panel: Page): Promise<void> {
  await panel.waitForFunction(() => {
    const text = document.getElementById('page-status')?.textContent ?? '';
    return text !== '' && text !== 'No page yet.';
  });
}

/** Opens the stub page, then the side panel page in a tab, bound to the stub page's tab. */
export async function openPanel(session: Session): Promise<Page> {
  const { tabId } = await openStubPage(session);
  const panel = await openPanelFor(session, tabId);
  await panel.locator('#page-status').filter({ hasText: '127.0.0.1' }).waitFor();
  return panel;
}

/** Clicks the extension's toolbar button on `page`, as the user would: Chrome runs the
 *  action on the window's active tab, so `page` comes to the front first. */
export async function clickToolbarButton(session: Session, page: Page): Promise<void> {
  await page.bringToFront();
  const browser = session.context.browser();
  if (!browser) throw new Error('no browser connection');
  const cdp = await browser.newBrowserCDPSession();
  const url = page.url();
  const { targetInfos } = (await cdp.send('Target.getTargets', { filter: [{}] })) as {
    targetInfos: { type: string; url: string; targetId: string }[];
  };
  const tab = targetInfos.find((target) => target.type === 'tab' && target.url === url);
  if (!tab) throw new Error(`no tab target for ${url}`);
  await cdp.send('Extensions.triggerAction', { id: session.extensionId, targetId: tab.targetId });
  await cdp.detach();
}
