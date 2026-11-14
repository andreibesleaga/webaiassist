// SPDX-License-Identifier: Apache-2.0
// The conformance page itself, in Playwright's Chromium with WebMCP switched on and no
// extension: every case registers exactly the tools expect.json lists, and its own check ends
// as expect.json allows. This proves the page, not the extension (test/smoke/conformance.spec.ts).
import { chromium, expect, test, type Browser, type Page } from '@playwright/test';
import { expandNames, loadExpect, type CaseExpect } from '../../scripts/eval/conformance-expect.ts';
import { startConformanceServer, type ConformanceServer } from './conformance-server';

const expectFile = loadExpect();
let server: ConformanceServer;
let browser: Browser;

test.beforeAll(async () => {
  server = await startConformanceServer();
  browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-features=WebMCPTesting'],
  });
});
test.afterAll(async () => {
  await browser.close();
  await server.close();
});

const address = (query: string): string =>
  `${server.origin}/index.html?${query}&other=${encodeURIComponent(`${server.otherOrigin}/`)}`;

interface Report {
  readonly features: Record<string, boolean>;
  readonly results: { id: string; status: string; detail: string }[];
}

const report = (page: Page): Promise<Report> =>
  page.evaluate(() =>
    (window as unknown as { __conformance: { report(): Report } }).__conformance.report(),
  );

async function listed(page: Page): Promise<string[]> {
  const names = await page.evaluate(async () =>
    ((await document.modelContext?.getTools()) ?? []).map((tool) => tool.name),
  );
  return names.sort();
}

async function openCase(query: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(address(query));
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { ready: boolean } }).__conformance.ready,
    null,
    { timeout: 30_000 },
  );
  return page;
}

async function selfRun(query: string): Promise<Report> {
  const page = await browser.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(address(`${query}&mode=self`));
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { done: boolean } }).__conformance.done,
    null,
    { timeout: 60_000 },
  );
  const result = await report(page);
  await page.close();
  expect(problems).toEqual([]);
  return result;
}

const title = (id: string, c: CaseExpect): string => `${id.toUpperCase()} ${c.title.toLowerCase()}`;

for (const [id, c] of Object.entries(expectFile.cases)) {
  test(`${title(id, c)}: the page registers exactly the tools expect.json lists`, async () => {
    const page = await openCase(`case=${id}`);
    expect(await listed(page)).toEqual(expandNames(c.tools));
    await page.close();
  });

  test(`${title(id, c)}: the page's own check ends as expect.json allows`, async () => {
    const run = await selfRun(`case=${id}`);
    const mine = run.results.filter((r) => r.id === id);
    expect(mine).toHaveLength(1);
    expect(c.selfStatus, `${mine[0]?.status}: ${mine[0]?.detail}`).toContain(mine[0]?.status);
  });
}

test('the index registers nothing and names the features of the browser', async () => {
  const page = await browser.newPage();
  await page.goto(`${server.origin}/index.html`);
  await expect(page.locator('#features li')).toContainText([
    'modelContext: yes',
    'registerTool: yes',
  ]);
  expect(await listed(page)).toEqual([]);
  await expect(page.locator('#case-list tr')).toHaveCount(Object.keys(expectFile.cases).length);
  await page.close();
});

test('all cases at once: every tool of every case, every check, no page error', async () => {
  const run = await selfRun('case=all');
  expect(run.results.map((r) => r.id)).toEqual(Object.keys(expectFile.cases));
  const bad = run.results.filter((r) => r.status === 'fail');
  expect(bad).toEqual([]);
  const page = await openCase('case=all');
  const wanted = Object.values(expectFile.cases).flatMap((c) => expandNames(c.tools));
  const found = await listed(page);
  // c12 adds a tool after three seconds, and some checks add and remove their own tools.
  for (const name of wanted) expect(found).toContain(name);
  await page.close();
});

test('the page works as a plain static folder: no request leaves the two loopback hosts', async () => {
  const page = await browser.newPage();
  const outside: string[] = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (host !== '127.0.0.1' && host !== '127.0.0.2') outside.push(request.url());
  });
  await page.goto(address('case=all&mode=self'));
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { done: boolean } }).__conformance.done,
    null,
    { timeout: 60_000 },
  );
  expect(outside).toEqual([]);
  expect(server.requests.every((path) => !path.startsWith('//'))).toBe(true);
  await page.close();
});

test('without document.modelContext the page says so and reports every case as unsupported', async () => {
  const plain = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await plain.newPage();
  await page.goto(`${server.origin}/index.html?case=all&mode=self`);
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { done: boolean } }).__conformance.done,
    null,
    { timeout: 30_000 },
  );
  await expect(page.locator('#no-support')).toBeVisible();
  const run = await report(page);
  expect(run.features.modelContext).toBe(false);
  expect(new Set(run.results.map((r) => r.status))).toEqual(new Set(['unsupported']));
  await plain.close();
});
