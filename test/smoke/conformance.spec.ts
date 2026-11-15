// SPDX-License-Identifier: Apache-2.0
// The built extension (smoke build, scripted model, real side panel) against every case of the
// conformance page: what the panel lists, what it asks before a call, what it shows as the
// result or the error. The steps and expected texts are in conformance/expect.json; the same
// steps run in real Google Chrome with `npm run eval:conformance -- --extension`.
// Behaviour that a later package builds is written as test.fixme with its package named, so
// that package only removes the `fixme`.
import { expect, test, type Page } from '@playwright/test';
import { expandNames, listedOf, loadExpect } from '../../scripts/eval/conformance-expect.ts';
import {
  askPanel,
  listedAfter,
  runExtensionCase,
  startScripted,
  useConfirmMode,
} from '../../scripts/eval/conformance-run.ts';
import { startConformanceServer, type ConformanceServer } from './conformance-server';
import { activeTab, openPanelFor, startSession, type Session } from './harness';

const expectFile = loadExpect();
let session: Session;
let site: ConformanceServer;

test.beforeAll(async () => {
  site = await startConformanceServer();
  session = await startSession();
});
test.afterAll(async () => {
  await session.close();
  await site.close();
});

/** The case's page and the side panel bound to its tab. */
async function open(id: string): Promise<{ page: Page; panel: Page }> {
  const other = encodeURIComponent(`${site.otherOrigin}/`);
  const page = await session.context.newPage();
  await page.goto(`${site.origin}/index.html?case=${id}&other=${other}`);
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { ready: boolean } }).__conformance.ready,
  );
  const { tabId } = await activeTab(session, page);
  return { page, panel: await openPanelFor(session, tabId) };
}

for (const [id, c] of Object.entries(expectFile.cases)) {
  test(`${id.toUpperCase()} ${c.title.toLowerCase()}: the panel lists, asks and shows as expect.json says`, async () => {
    const { page, panel } = await open(id);
    const checks = await runExtensionCase(panel, page, c);
    const failed = checks.filter((check) => !check.ok);
    expect(failed, JSON.stringify(failed, null, 1)).toEqual([]);
    await page.close();
    await panel.close();
  });
}

test('the default mode asks before a read-only tool too ("ask for every call")', async () => {
  const { page, panel } = await open('c01');
  await useConfirmMode(panel, 'every-call');
  await startScripted(panel);
  const seen = await askPanel(panel, '/tool c01_titled {}');
  expect(seen.questions).toContain('Run the tool c01_titled?');
  expect(seen.transcript).toContain('The tool said: c01_titled');
  await page.close();
});

test('C08 Stop in the panel cancels the running tool call on the page', async () => {
  const { page, panel } = await open('c08');
  await useConfirmMode(panel, 'per-site');
  await startScripted(panel);
  const seen = await askPanel(panel, '/tool c08_cancellable {}', { stopAfterMs: 1_500 });
  expect(seen.transcript).toContain('Stopped.');
  // The panel passes the abort on: the page's execute sees its signal abort.
  await expect(page.locator('#c08-log')).toContainText('execute saw the abort', { timeout: 3_000 });
  await page.close();
});

// Findings and later packages ------------------------------------------------------------

test('C05 a tool with the debugging hint is listed for you, marked "for developers", and not offered to the model', async () => {
  const { page, panel } = await open('c05');
  await listedAfter(
    panel,
    expandNames(listedOf(expectFile.cases.c05 ?? { title: '', tools: [], selfStatus: [] })),
  );
  await panel.click('#tools-toggle');
  const row = panel.locator('#tools-rows li', { hasText: 'c05_debugging' });
  await expect(row).toContainText('for developers');
  // The model's request does not contain it: asking for it by name gets "unknown tool" (expect.json c05).
  await page.close();
});

test('C05 the tool detail view shows every hint of a tool, debugging included', async () => {
  const { page, panel } = await open('c05');
  await panel.click('#tools-toggle');
  await panel.getByRole('button', { name: 'Open the tool c05_all' }).click();
  await expect(panel.getByText('debugging: yes')).toBeVisible();
  await page.close();
});

test('C03 a null result after a navigation is shown as "the page navigated"', async () => {
  const { page, panel } = await open('c03');
  await startScripted(panel);
  const seen = await askPanel(panel, '/tool c03_navigate {}');
  expect(seen.transcript).toContain('the page navigated');
  await page.close();
});

test('C11 the panel says the page waits for you to press Submit for a form tool without toolautosubmit', async () => {
  const { page, panel } = await open('c11');
  await startScripted(panel);
  const seen = await askPanel(panel, '/tool c11_wait {"q":"y"}', { timeoutMs: 6_000 });
  expect(seen.transcript).toContain('press Submit');
  await page.close();
});

test('C15 the tool security review flags look-alike names and a destructive name marked read-only', async () => {
  const { page, panel } = await open('c15');
  await panel.click('#tools-toggle');
  const row = (name: string) => panel.locator(`#tools-rows li[data-tool="${name}"]`);
  await expect(row('c15_account_deIete')).toContainText('look-alike');
  await expect(row('c15_delete_account')).toContainText('check');
  await page.close();
});

test('C16 no page tool named like webaiassist_query_graph reaches the model, and the card marks each one', async () => {
  const { page, panel } = await open('c16');
  await panel.click('#tools-toggle');
  const rows = panel.locator('#tools-rows li');
  await expect(rows).toHaveCount(4);
  for (const row of await rows.all()) await expect(row).toContainText('built-in');
  await startScripted(panel);
  const seen = await askPanel(panel, '/tool webaiassist_query_graph {}');
  expect(seen.questions).not.toContain('Run the tool webaiassist_query_graph?');
  expect(seen.transcript).not.toContain('this came from the page, not from the assistant');
  expect(seen.transcript).toContain('unknown tool');
  await page.close();
});

test('C09 a slow call and its end appear in the activity log', async () => {
  const { page, panel } = await open('c09');
  await startScripted(panel);
  await askPanel(panel, '/tool c09_two_seconds {}');
  await panel.click('#more-toggle');
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-activity');
  const explorer = await opened;
  await explorer.waitForLoadState('domcontentloaded');
  await expect(explorer.getByRole('log', { name: /activity/i })).toContainText('c09_two_seconds');
  await explorer.close();
  await page.close();
});
