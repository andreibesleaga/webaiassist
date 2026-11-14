// SPDX-License-Identifier: Apache-2.0
// The eval's browser: the stub node server, Chromium with the eval build (dist-eval/) loaded
// unpacked, and the helpers to open a page and the side panel page bound to its tab. Set-up
// follows test/smoke/harness.ts. The eval build may script 127.0.0.1, localhost and
// agenticsystemcore.com from install, so no toolbar click is needed.
import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EvalArgs } from './args.ts';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist-eval');
const FILES: Readonly<Record<string, { path: string; type: string }>> = {
  '/': { path: 'scripts/eval/stub-node.html', type: 'text/html; charset=utf-8' },
  '/tools.json': { path: 'fixtures/agsc-tools.json', type: 'application/json' },
  '/answers.json': { path: 'fixtures/agsc-answers.json', type: 'application/json' },
};

export interface RequestRecord {
  readonly t: number;
  readonly url: string;
}

export interface EvalSession {
  readonly context: BrowserContext;
  readonly worker: Worker;
  readonly extensionId: string;
  /** The stub node, http://localhost:<port>. */
  readonly stubUrl: string;
  /** Every request the browser made, in order. */
  readonly requests: readonly RequestRecord[];
  readonly chromeVersion: string;
  openTarget(url: string): Promise<{ page: Page; tabId: number }>;
  openPanelFor(tabId: number): Promise<Page>;
  openExtensionPage(name: string): Promise<Page>;
  close(): Promise<void>;
}

/** The browser profile of the eval. WEBAIASSIST_EVAL_PROFILE keeps it between runs (eval:cpu uses
 *  it to start a second time from the stored model file). */
export const profileDir = (): string =>
  process.env.WEBAIASSIST_EVAL_PROFILE ?? join(tmpdir(), 'webaiassist-eval-profile');

function serveStub(): Promise<Server> {
  const server = createServer((request, response) => {
    const file = FILES[request.url ?? ''];
    if (!file) return void response.writeHead(404).end();
    response.writeHead(200, { 'content-type': file.type }).end(readFileSync(join(ROOT, file.path)));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** A started browser; `extensionId` is set when the launcher knows it (Google Chrome, where
 *  other extensions of the browser have service workers too). */
export interface Launched {
  readonly context: BrowserContext;
  readonly extensionId?: string;
}
export type Launcher = (args: EvalArgs) => Promise<Launched>;

/** The built extension the eval loads. */
export const EVAL_DIST = DIST;

async function launch(args: EvalArgs): Promise<Launched> {
  if (args.freshProfile) rmSync(profileDir(), { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(profileDir(), {
    channel: args.channel,
    headless: args.headless,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--enable-features=WebMCPTesting',
      '--enable-unsafe-extension-debugging',
    ],
  });
  return { context };
}

/** The extension's service worker; with a known id, an extension page wakes it first. */
async function workerOf({ context, extensionId }: Launched): Promise<Worker> {
  const mine = (worker: Worker): boolean =>
    extensionId === undefined || new URL(worker.url()).host === extensionId;
  const running = context.serviceWorkers().find(mine);
  if (running) return running;
  const started = context.waitForEvent('serviceworker', { predicate: mine, timeout: 30_000 });
  if (extensionId !== undefined) {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.close();
  }
  return started;
}

async function activeTabId(worker: Worker): Promise<number> {
  const id = await worker.evaluate(
    async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id,
  );
  if (id === undefined) throw new Error('no active tab');
  return id;
}

function recordRequests(context: BrowserContext): RequestRecord[] {
  const requests: RequestRecord[] = [];
  context.on('request', (r) => requests.push({ t: Date.now(), url: r.url() }));
  return requests;
}

async function openAt(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  return page;
}

async function launchWithWorker(
  args: EvalArgs,
  launcher: Launcher,
): Promise<{ context: BrowserContext; worker: Worker }> {
  const launched = await launcher(args);
  return { context: launched.context, worker: await workerOf(launched) };
}

/** Starts the stub server and the browser with the extension. */
export async function startSession(
  args: EvalArgs,
  launcher: Launcher = launch,
): Promise<EvalSession> {
  process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
  const server = await serveStub();
  const { context, worker } = await launchWithWorker(args, launcher).catch((error: unknown) => {
    server.close();
    throw error;
  });
  const requests = recordRequests(context);
  const extensionId = new URL(worker.url()).host;
  const port = (server.address() as AddressInfo).port;
  const openExtensionPage = (name: string): Promise<Page> =>
    openAt(context, `chrome-extension://${extensionId}/${name}`);
  return {
    context,
    worker,
    extensionId,
    stubUrl: `http://localhost:${port}`,
    requests,
    chromeVersion: context.browser()?.version() ?? 'unknown',
    openExtensionPage,
    openTarget: async (url) => {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
      await page.bringToFront();
      return { page, tabId: await activeTabId(worker) };
    },
    openPanelFor: async (tabId) => {
      const panel = await openExtensionPage(`sidepanel.html?tab=${tabId}`);
      await panel.locator('#page-status').filter({ hasNotText: 'No page yet.' }).waitFor();
      return panel;
    },
    close: async () => {
      await context.close();
      server.close();
    },
  };
}
