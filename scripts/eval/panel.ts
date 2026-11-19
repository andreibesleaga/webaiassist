// SPDX-License-Identifier: Apache-2.0
// The side panel as the eval's user: choose and start a model, ask a question through the
// confirmation gate, and report what the transcript showed (scored by score.ts).
import type { Page } from '@playwright/test';
import { MODEL_IDS, type ModelKey } from './args.ts';
import {
  errorLines,
  firstTokenMs,
  modelState,
  percent,
  pickAnswer,
  repeatedCalls,
  snapshotOf,
  toolCount,
  toolFromTitle,
  type Item,
  type Snapshot,
} from './observe.ts';
import type { ModelLine } from './report.ts';
import type { Observation } from './score.ts';

export type StartResult = Pick<ModelLine, 'ready' | 'loadS' | 'status'>;

const POLL_MS = 150;
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const text = async (panel: Page, selector: string): Promise<string> =>
  (await panel.locator(selector).first().textContent()) ?? '';

export async function selectModel(panel: Page, key: ModelKey): Promise<void> {
  await panel.selectOption('#model', key === 'scripted' ? 'scripted' : `webllm:${MODEL_IDS[key]}`);
}

export const modelStatus = (panel: Page): Promise<string> => text(panel, '#model-status');

async function progressPercent(panel: Page): Promise<string> {
  return percent(
    await panel.locator('#progress').evaluate((el) => (el as HTMLProgressElement).value),
  );
}

/** Presses Start and, when the panel asks before a first download, presses "Download". */
export async function pressStart(panel: Page): Promise<void> {
  await panel.click('#start');
  const asked = await panel
    .locator('#consent:visible')
    .waitFor({ timeout: 3_000 })
    .then(
      () => true,
      () => false,
    );
  if (asked) await panel.click('#consent-ok');
}

/** Presses Start and watches the model line until it is ready or reports an error. */
export async function startModel(panel: Page, timeoutMin: number): Promise<StartResult> {
  const began = performance.now();
  // Start is off while a load runs (after Cancel, only until the panel answers it).
  const usable = await panel
    .locator('button#start:enabled')
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  if (!usable) {
    return {
      ready: false,
      loadS: 0,
      status: `Start stayed off for 10 s: ${await modelStatus(panel)}`,
    };
  }
  await pressStart(panel);
  let nextReport = began + 10_000;
  for (;;) {
    const status = await modelStatus(panel);
    const state = modelState(status);
    const loadS = Math.round((performance.now() - began) / 100) / 10;
    if (state !== 'loading') return { ready: state === 'ready', loadS, status };
    if (performance.now() - began > timeoutMin * 60_000) {
      return { ready: false, loadS, status: `timed out after ${timeoutMin} min: ${status}` };
    }
    if (performance.now() >= nextReport) {
      console.log(`  loading ${await progressPercent(panel)} (${Math.round(loadS)} s)`);
      nextReport += 10_000;
    }
    await sleep(500);
  }
}

/** The page line of the panel, e.g. "localhost:1234 — 10 WebMCP tools". */
/** Empties what the extension remembers of every site (saved chats and tool counts), so a
 *  question sees no earlier one. The eval's browser profile is kept between runs, and the panel
 *  restores a site's saved chat: without this, a question on the live node saw the answers of
 *  older runs and of other models (found on 18 Nov 2026). */
export async function clearMemory(panel: Page): Promise<void> {
  await panel.evaluate(async () => {
    const known = await indexedDB.databases();
    if (!known.some((db) => db.name === 'webaiassist')) return;
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('webaiassist');
      open.onerror = () => reject(new Error('the memory database did not open'));
      open.onsuccess = () => {
        const db = open.result;
        const names = [...db.objectStoreNames];
        if (names.length === 0) {
          db.close();
          resolve();
          return;
        }
        const tx = db.transaction(names, 'readwrite');
        for (const name of names) tx.objectStore(name).clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(new Error('the memory database did not clear'));
      };
    });
  });
}

export const pageStatus = (panel: Page): Promise<string> => text(panel, '#page-status');

/** How many WebMCP tools the panel says the open page has. */
export async function pageTools(panel: Page): Promise<number> {
  return toolCount(await pageStatus(panel));
}

/** The transcript items as the panel shows them. */
export async function readItems(panel: Page): Promise<Item[]> {
  return panel.locator('#transcript > li').evaluateAll((lis) =>
    lis.map((li) => {
      const copy = li.cloneNode(true) as HTMLElement;
      const who = copy.querySelector(':scope > .who')?.textContent ?? null;
      copy.querySelector(':scope > .who')?.remove();
      copy.querySelectorAll('[data-trust="untrusted"]').forEach((el) => el.remove());
      return {
        who,
        untrusted: li.getAttribute('data-trust') === 'untrusted',
        text: li.getAttribute('data-trust') === 'untrusted' ? '' : (copy.textContent ?? ''),
      };
    }),
  );
}

interface Run {
  readonly tools: string[];
  readonly gates: string[];
  readonly snaps: Snapshot[];
}

export type GateHook = (title: string) => Promise<void>;

/** Answers a visible confirmation question; records the tool it names. */
async function answerGate(panel: Page, run: Run, onGate?: GateHook): Promise<boolean> {
  if (!(await panel.locator('#confirm-title').isVisible())) return false;
  const title = await text(panel, '#confirm-title');
  const tool = toolFromTitle(title);
  if (tool !== null) {
    run.gates.push(tool);
    run.tools.push(tool);
  }
  await onGate?.(title);
  await panel.click('#confirm-allow');
  return true;
}

/** Ended: the send button is enabled again after the run was seen (or nothing ran for 3 s). */
const ended = (sawRunning: boolean, running: boolean, waitedMs: number): boolean =>
  !running && (sawRunning || waitedMs > 3_000);

async function waitForUserTurn(panel: Page, before: number): Promise<void> {
  const until = performance.now() + 10_000;
  while (performance.now() < until && (await readItems(panel)).length <= before)
    await sleep(POLL_MS);
}

/** Watches the answer until it ends; true when `timeoutS` passed first. */
async function watch(
  panel: Page,
  run: Run,
  limit: { start: number; timeoutS: number },
  onGate?: GateHook,
): Promise<boolean> {
  const turnAt = performance.now();
  let sawRunning = false;
  for (;;) {
    const gate = await answerGate(panel, run, onGate);
    const running = await panel.locator('#send').isDisabled();
    sawRunning ||= running;
    run.snaps.push(snapshotOf(performance.now(), await readItems(panel), gate));
    if (!gate && ended(sawRunning, running, performance.now() - turnAt)) return false;
    if (performance.now() - limit.start > limit.timeoutS * 1000) return true;
    await sleep(POLL_MS);
  }
}

async function pageErrors(panel: Page): Promise<string[]> {
  const lines = [await pageStatus(panel), await modelStatus(panel)];
  return lines.filter((line) => /error|failed|did not load/i.test(line));
}

/** Types `question` into the panel and follows the run to its end, allowing every gate. */
export async function ask(
  panel: Page,
  question: string,
  timeoutS: number,
  onGate?: GateHook,
): Promise<Observation> {
  const before = (await readItems(panel)).length;
  const start = performance.now();
  await panel.fill('#question', question);
  await panel.press('#question', 'Control+Enter');
  await waitForUserTurn(panel, before);
  const run: Run = { tools: [], gates: [], snaps: [] };
  const timedOut = await watch(panel, run, { start, timeoutS }, onGate);
  const items = await readItems(panel);
  return {
    tools: run.tools,
    gates: run.gates,
    answer: pickAnswer(items),
    errors: [...errorLines(items), ...(await pageErrors(panel))],
    repeated: repeatedCalls(items),
    firstTokenMs: firstTokenMs(run.snaps, start),
    totalMs: performance.now() - start,
    timedOut,
  };
}
