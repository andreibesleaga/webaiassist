// SPDX-License-Identifier: Apache-2.0
// The two ways a user opens WebAIAssist on a page it may not script yet (the owner's first
// test, 13 Nov 2026). The stub page is served at http://localhost:<port>, which the
// smoke-test build has no access to (harness.ts).
// 1. The toolbar button: the click opens the side panel, grants the page (activeTab) and adds
//    the page scripts; the panel lists the page's tools.
// 2. The side panel opened another way: one "not allowed yet" line with an Allow button and
//    no error. Allow asks Chrome to show its site-access request; accepting that request is a
//    click in Chrome's own toolbar, which a test cannot make, so the grant here comes from the
//    toolbar button, the other route the line names. The panel then lists the tools.
import { expect, test } from '@playwright/test';
import {
  clickToolbarButton,
  openPanelFor,
  openStubPage,
  startSession,
  type Session,
} from './harness';

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
});
test.afterEach(async () => {
  await session.close();
});

const host = (): string => new URL(session.localOrigin).host;

test('toolbar button: opens the side panel, grants the page and lists its tools', async () => {
  const { page, tabId } = await openStubPage(session, session.localOrigin);
  await clickToolbarButton(session, page);
  await expect
    .poll(() =>
      session.worker.evaluate(
        async () =>
          (
            await chrome.runtime.getContexts({
              contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
            })
          ).length,
      ),
    )
    .toBe(1);
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#page-status')).toHaveText(`${host()} — 2 WebMCP tools`);
  await expect(panel.locator('#allow-site')).toBeHidden();
});

test('side panel opened another way: one Allow line, no error, then the tools once granted', async () => {
  const { page, tabId } = await openStubPage(session, session.localOrigin);
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#page-status')).toHaveText('This page — not allowed yet');
  await expect(panel.locator('#allow-site')).toHaveText('Allow WebAIAssist on this site');

  await panel.click('#read-page');
  await panel.click('#read-page');
  await expect(panel.locator('#page-note')).toContainText('not allowed on this page yet');
  await expect(panel.locator('#transcript li')).toHaveCount(0);

  await panel.click('#allow-site');
  await expect(panel.locator('#page-note')).toContainText('next to the address bar');

  await clickToolbarButton(session, page);
  await expect(panel.locator('#page-status')).toHaveText(`${host()} — 2 WebMCP tools`);
  await expect(panel.locator('#allow-site')).toBeHidden();
  await expect(panel.locator('#page-note')).toHaveText('');
});
