// SPDX-License-Identifier: Apache-2.0
// Runs one conformance case against the side panel with the scripted model: what the panel lists,
// the page actions, and each tool call through the confirmation gate. Used by the Playwright
// specs (test/smoke/conformance.spec.ts) and by `npm run eval:conformance -- --extension`.
import type { Page } from '@playwright/test';
import { expandNames, listedOf, type CallExpect, type CaseExpect } from './conformance-expect.ts';

export interface Checked {
  readonly step: string;
  readonly ok: boolean;
  readonly detail: string;
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** The tool names the panel lists on its card, sorted (the rows exist even while the list is shut). */
export async function listedNames(panel: Page): Promise<string[]> {
  const names = await panel.locator('#tools-rows li code').allTextContents();
  return names.sort();
}

/** Waits until the panel lists exactly `wanted`; returns what it listed last. */
export async function listedAfter(
  panel: Page,
  wanted: readonly string[],
  ms = 8_000,
): Promise<string[]> {
  const until = Date.now() + ms;
  let seen = await listedNames(panel);
  while (Date.now() < until && JSON.stringify(seen) !== JSON.stringify(wanted)) {
    await sleep(150);
    seen = await listedNames(panel);
  }
  return seen;
}

/** Sets the Options "ask" choice and reloads the panel: "per-site" asks only before tools that may
 *  change something (the expect.json `confirm` flags describe this mode; "every-call" is the default). */
export async function useConfirmMode(panel: Page, mode: 'every-call' | 'per-site'): Promise<void> {
  await panel.evaluate(async (value) => {
    const stored = await chrome.storage.local.get<{ settings?: object }>('settings');
    await chrome.storage.local.set({ settings: { ...stored.settings, confirmMode: value } });
  }, mode);
  await panel.reload();
  await panel.waitForFunction(() => {
    const text = document.getElementById('page-status')?.textContent ?? '';
    return text !== '' && text !== 'No page yet.';
  });
}

export async function startScripted(panel: Page): Promise<void> {
  await panel.selectOption('#model', 'scripted');
  await panel.click('#start');
  await panel.locator('#model-status').filter({ hasText: 'Ready' }).waitFor({ timeout: 20_000 });
}

export interface RunSeen {
  /** Titles of every question the panel asked, in order. */
  readonly questions: string[];
  readonly transcript: string;
  readonly timedOut: boolean;
}

export interface RunOptions {
  readonly timeoutMs?: number;
  /** Called once, with the first tool question on screen, before it is answered. */
  readonly onQuestion?: (title: string) => Promise<void>;
  /** Presses Stop (the panel's own button) after this many ms instead of waiting for the end. */
  readonly stopAfterMs?: number;
  /** Deny the tool question instead of allowing it. */
  readonly deny?: boolean;
}

async function answerQuestion(panel: Page, seen: string[], options: RunOptions): Promise<boolean> {
  if (!(await panel.locator('#confirm-title').isVisible())) return false;
  const title = ((await panel.locator('#confirm-title').textContent()) ?? '').trim();
  seen.push(title);
  const isTool = title.startsWith('Run the tool');
  await options.onQuestion?.(title);
  await panel.click(options.deny === true && isTool ? '#confirm-deny' : '#confirm-allow');
  return true;
}

interface Pace {
  readonly began: number;
  sawBusy: boolean;
  stopped: boolean;
}

/** True when the answer has ended: the send button is back after it was seen busy (or nothing ran for 3 s). */
async function ended(panel: Page, pace: Pace): Promise<boolean> {
  const busy = await panel.locator('#send').isDisabled();
  pace.sawBusy ||= busy;
  return !busy && (pace.sawBusy || Date.now() - pace.began > 3_000);
}

async function stopWhenDue(panel: Page, pace: Pace, afterMs: number | undefined): Promise<void> {
  if (afterMs === undefined || pace.stopped || Date.now() - pace.began <= afterMs) return;
  pace.stopped = true;
  await panel.keyboard.press('Escape');
}

/** Types `question`, answers every question, and returns when the answer ended (or `timeoutMs`). */
export async function askPanel(
  panel: Page,
  question: string,
  options: RunOptions = {},
): Promise<RunSeen> {
  const questions: string[] = [];
  await panel.fill('#question', question);
  await panel.press('#question', 'Control+Enter');
  const pace: Pace = { began: Date.now(), sawBusy: false, stopped: false };
  let timedOut = false;
  for (;;) {
    if (await answerQuestion(panel, questions, options)) continue;
    await stopWhenDue(panel, pace, options.stopAfterMs);
    if (await ended(panel, pace)) break;
    timedOut = Date.now() - pace.began > (options.timeoutMs ?? 40_000);
    if (timedOut) break;
    await sleep(100);
  }
  const transcript = (await panel.locator('#transcript').textContent()) ?? '';
  return { questions, transcript, timedOut };
}

const command = (call: CallExpect): string => `/tool ${call.tool} ${JSON.stringify(call.args)}`;

function checkCall(call: CallExpect, seen: RunSeen): Checked {
  const asked = seen.questions.some((q) => q === `Run the tool ${call.tool}?`);
  const problems: string[] = [];
  if (asked !== call.confirm) problems.push(asked ? 'asked before running' : 'ran without asking');
  for (const text of call.shows)
    if (!seen.transcript.includes(text)) problems.push(`missing "${text}"`);
  for (const text of call.hides ?? [])
    if (seen.transcript.includes(text)) problems.push(`shows "${text}"`);
  if (seen.timedOut) problems.push('did not end in time');
  const tail = seen.transcript.replace(/\s+/g, ' ').slice(-240);
  return {
    step: `call ${call.tool}`,
    ok: problems.length === 0,
    detail: problems.length ? `${problems.join('; ')} | transcript ends: ${tail}` : 'as expected',
  };
}

async function runCall(panel: Page, page: Page, call: CallExpect): Promise<Checked> {
  let pressed: Promise<void> | undefined;
  const options: RunOptions = {
    onQuestion: async (title) => {
      if (!title.startsWith('Run the tool')) return;
      if (call.duringQuestion) await page.click(call.duringQuestion.click);
      // The page's own button is pressed a moment after the tool question is allowed.
      const selector = call.whileWaiting?.click;
      if (selector) pressed = sleep(1_500).then(() => page.click(selector));
    },
    ...(call.stopAfterMs === undefined ? {} : { stopAfterMs: call.stopAfterMs }),
  };
  const seen = await askPanel(panel, command(call), options);
  await pressed;
  return checkCall(call, seen);
}

/** Every check of a case: the list, the page actions, the calls. */
export async function runExtensionCase(
  panel: Page,
  page: Page,
  expected: CaseExpect,
): Promise<Checked[]> {
  const out: Checked[] = [];
  const first = await listedAfter(panel, listedOf(expected));
  out.push({
    step: 'list',
    ok: JSON.stringify(first) === JSON.stringify(listedOf(expected)),
    detail: `panel lists ${first.length} tools`,
  });
  for (const action of expected.page ?? []) {
    await page.click(action.click);
    const wanted = expandNames(action.listed);
    const seen = await listedAfter(panel, wanted);
    out.push({
      step: `click ${action.click}`,
      ok: JSON.stringify(seen) === JSON.stringify(wanted),
      detail: `panel lists ${seen.length} tools`,
    });
  }
  if ((expected.calls ?? []).length > 0) {
    await useConfirmMode(panel, 'per-site');
    await startScripted(panel);
  }
  for (const call of expected.calls ?? []) out.push(await runCall(panel, page, call));
  if (expected.listedAfterCalls) {
    const wanted = expandNames(expected.listedAfterCalls);
    const seen = await listedAfter(panel, wanted);
    out.push({
      step: 'list after the calls',
      ok: JSON.stringify(seen) === JSON.stringify(wanted),
      detail: `panel lists ${seen.length} tools`,
    });
  }
  return out;
}
