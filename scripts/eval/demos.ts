// SPDX-License-Identifier: Apache-2.0
// The demo-page stage of `npm run eval:conformance -- --demos`: opens each official WebMCP demo
// page of Google (scripts/eval/demo-pages.json), records the tools the page registers, whether the
// panel lists them, and, with the scripted model, one read-only call through the confirmation.
// It never submits a form and never calls a tool that is not marked read-only.
import type { Page } from '@playwright/test';
import {
  demoUrl,
  loadDemoPages,
  panelListsAll,
  pickReadOnlyCall,
  type DemoRow,
  type SeenTool,
} from './conformance-report.ts';
import { askPanel, listedNames, startScripted, useConfirmMode } from './conformance-run.ts';
import type { EvalSession } from './session.ts';

const WAIT_FOR_TOOLS_MS = 20_000;

/** The page's own view of its tools (the page world, as a script on the page sees them). */
async function seenTools(page: Page): Promise<SeenTool[]> {
  return page.evaluate(async () => {
    const context = (document as unknown as { modelContext?: { getTools(): Promise<unknown[]> } })
      .modelContext;
    const tools = (await context?.getTools()) ?? [];
    return tools.map((entry) => {
      const tool = entry as {
        name: string;
        annotations?: { readOnlyHint?: boolean };
        inputSchema?: { required?: string[] };
      };
      return {
        name: tool.name,
        readOnly: tool.annotations?.readOnlyHint === true,
        required: tool.inputSchema?.required ?? [],
      };
    });
  });
}

async function waitForTools(page: Page): Promise<SeenTool[]> {
  const until = Date.now() + WAIT_FOR_TOOLS_MS;
  let tools = await seenTools(page).catch(() => []);
  while (tools.length === 0 && Date.now() < until) {
    await page.waitForTimeout(500);
    tools = await seenTools(page).catch(() => []);
  }
  return tools;
}

async function oneCall(panel: Page, tool: string): Promise<NonNullable<DemoRow['call']>> {
  await useConfirmMode(panel, 'every-call');
  await startScripted(panel);
  const seen = await askPanel(panel, `/tool ${tool} {}`, { timeoutMs: 30_000 });
  return {
    tool,
    asked: seen.questions.includes(`Run the tool ${tool}?`),
    result: seen.transcript.replace(/\s+/g, ' ').slice(-200),
  };
}

async function oneDemo(session: EvalSession, url: string, id: string): Promise<DemoRow> {
  const { page, tabId } = await session.openTarget(url);
  try {
    const tools = await waitForTools(page);
    const panel = await session.openPanelFor(tabId);
    await page.waitForTimeout(1_500);
    const names = tools.map((tool) => tool.name).sort();
    const listed = await listedNames(panel);
    const pick = pickReadOnlyCall(tools);
    const call = pick === undefined ? undefined : await oneCall(panel, pick);
    await panel.close();
    return {
      id,
      url,
      tools: names,
      panelLists: listed,
      panelListsAll: panelListsAll(names, listed),
      ...(call ? { call } : {}),
      ...(call || names.length === 0
        ? {}
        : { note: 'no read-only tool without required arguments: nothing was called' }),
    };
  } finally {
    await page.close();
  }
}

/** One row per demo page; a page that does not load is a row with a note, not a failed run. */
export async function runDemos(session: EvalSession): Promise<DemoRow[]> {
  const file = loadDemoPages();
  const rows: DemoRow[] = [];
  for (const page of file.pages) {
    const url = demoUrl(file, page);
    try {
      rows.push(await oneDemo(session, url, page.id));
    } catch (error) {
      const note =
        error instanceof Error ? (error.message.split('\n')[0] ?? 'failed') : String(error);
      rows.push({ id: page.id, url, tools: [], panelLists: [], panelListsAll: false, note });
    }
    console.log(`  demo ${page.id}: ${rows.at(-1)?.tools.length ?? 0} tools`);
  }
  return rows;
}
