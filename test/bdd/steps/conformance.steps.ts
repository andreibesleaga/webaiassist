// SPDX-License-Identifier: Apache-2.0
// Steps of feature 23 (the WebMCP conformance page and suite). The cases and their expected
// results are in conformance/expect.json; the runner is the one real Chrome uses
// (scripts/eval/conformance-run.ts).
import { expect, type Page } from '@playwright/test';
import {
  expandNames,
  loadExpect,
  type CaseExpect,
} from '../../../scripts/eval/conformance-expect.ts';
import { runExtensionCase, type Checked } from '../../../scripts/eval/conformance-run.ts';
import {
  startConformanceServer,
  type ConformanceServer,
} from '../../../scripts/eval/conformance-server.ts';
import { activeTab, openPanelFor } from '../../smoke/harness';
import type { World } from '../world';
import { Given, Then, When } from './fixtures';

interface Open {
  page: Page;
  panel?: Page;
  checks?: Checked[];
}

const opened = new WeakMap<World, Open>();
let site: ConformanceServer | undefined;

const caseOf = (id: string): CaseExpect => {
  const found = loadExpect().cases[id];
  if (!found) throw new Error(`no conformance case ${id}`);
  return found;
};

async function server(): Promise<ConformanceServer> {
  site ??= await startConformanceServer({ unref: true });
  return site;
}

async function openCase(world: World, id: string, query = ''): Promise<Page> {
  const { origin, otherOrigin } = await server();
  const session = await world.session();
  const page = await session.context.newPage();
  const other = encodeURIComponent(`${otherOrigin}/`);
  await page.goto(`${origin}/index.html?case=${id}&other=${other}${query}`);
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { ready: boolean } }).__conformance.ready,
  );
  return page;
}

const pageOf = (world: World): Open => {
  const state = opened.get(world);
  if (!state) throw new Error('open a conformance case first');
  return state;
};

Given('the conformance page is open on case {string}', async ({ world }, id: string) => {
  opened.set(world, { page: await openCase(world, id) });
});

Then('the page registers exactly the tools of case {string}', async ({ world }, id: string) => {
  const names = await pageOf(world).page.evaluate(async () =>
    ((await document.modelContext?.getTools()) ?? []).map((tool) => tool.name),
  );
  expect(names.sort()).toEqual(expandNames(caseOf(id).tools));
});

Then('its own check of case {string} ends as the case allows', async ({ world }, id: string) => {
  const page = await openCase(world, id, '&mode=self');
  await page.waitForFunction(
    () => (window as unknown as { __conformance: { done: boolean } }).__conformance.done,
    null,
    { timeout: 30_000 },
  );
  const status = await page.evaluate(
    (caseId) =>
      (
        window as unknown as { __conformance: { results: { id: string; status: string }[] } }
      ).__conformance.results.find((r) => r.id === caseId)?.status,
    id,
  );
  expect(caseOf(id).selfStatus).toContain(status);
});

Given(
  'the conformance case {string} is open with the side panel',
  async ({ world }, id: string) => {
    const page = await openCase(world, id);
    const { tabId } = await activeTab(await world.session(), page);
    opened.set(world, { page, panel: await openPanelFor(await world.session(), tabId) });
  },
);

When(
  'the scripted model makes the calls the case {string} lists',
  async ({ world }, id: string) => {
    const state = pageOf(world);
    if (!state.panel) throw new Error('no side panel');
    state.checks = await runExtensionCase(state.panel, state.page, caseOf(id));
  },
);

Then('every step of the case is as the case file says', ({ world }) => {
  const failed = (pageOf(world).checks ?? []).filter((check) => !check.ok);
  expect(failed, JSON.stringify(failed, null, 1)).toEqual([]);
});

Then('the step {string} is as the case file says', ({ world }, step: string) => {
  const found = (pageOf(world).checks ?? []).find((check) => check.step === step);
  expect(found?.ok, JSON.stringify(found)).toBe(true);
});
