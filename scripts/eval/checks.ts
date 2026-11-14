// SPDX-License-Identifier: Apache-2.0
// The observable manual checks of docs/EVAL.md, run by the eval: storage access level, hosts
// contacted on Start, cancelling a download, a corrupted cached library, and the panel after
// an idle wait. What a program cannot observe is listed in MANUAL.
import type { Page } from '@playwright/test';
import type { EvalArgs } from './args.ts';
import { offHosts } from './hosts.ts';
import { ask, modelStatus, pressStart, selectModel, startModel } from './panel.ts';
import { modelState } from './observe.ts';
import type { CheckResult } from './report.ts';
import type { EvalSession } from './session.ts';

export const MANUAL: readonly string[] = [
  'Edge/Brave/Opera/Vivaldi sideload',
  'screen reader',
  "Chrome's own site-access request from the toolbar (Allow button on a site without pre-granted access)",
];

export interface Window {
  readonly from: number;
  readonly to: number;
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const result = (name: string, r: CheckResult['result'], detail: string): CheckResult => ({
  name,
  result: r,
  detail,
});
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const WEIGHTS = /huggingface\.co|\.hf\.co|\/\/hf\.co/;

async function storageLevel(session: EvalSession): Promise<CheckResult> {
  const name = 'storage.local.setAccessLevel';
  try {
    await session.worker.evaluate(() =>
      chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    );
    return result(name, 'pass', 'resolved in the service worker');
  } catch (error) {
    return result(name, 'fail', message(error));
  }
}

function hostsCheck(session: EvalSession, window: Window, args: EvalArgs): CheckResult {
  const name = 'Hosts contacted on first Start';
  const urls = session.requests
    .filter((r) => r.t >= window.from && r.t <= window.to)
    .map((r) => r.url);
  const off = offHosts(urls);
  if (off.length > 0) return result(name, 'fail', `not in PRIVACY.md: ${off.join(', ')}`);
  const seen = `${urls.length} requests seen, none to a host PRIVACY.md does not name`;
  if (args.scripted || urls.some((url) => WEIGHTS.test(url))) return result(name, 'pass', seen);
  return result(
    name,
    'review',
    `${seen}; no model download seen (the offscreen document is not visible to Playwright): open DevTools on the first Start`,
  );
}

/** Cancel during a real download: only when the model is not cached. */
export async function cancelCheck(
  session: EvalSession,
  panel: Page,
  args: EvalArgs,
): Promise<CheckResult> {
  const name = 'Cancel stops the download';
  if (args.scripted) return result(name, 'skipped', 'scripted test model has no download');
  await pressStart(panel);
  await sleep(5_000);
  const progress = await panel
    .locator('#progress')
    .evaluate((el) => (el as HTMLProgressElement).value);
  if (progress >= 1 || modelState(await modelStatus(panel)) !== 'loading') {
    return result(name, 'skipped', 'model already cached; rerun with --fresh-profile');
  }
  await panel.click('#cancel-load');
  const pressed = Date.now();
  // Cancel must answer at once: Start usable again (the runtime may wind down for longer).
  const usable = await panel
    .locator('button#start:enabled')
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  const answerS = Math.round((Date.now() - pressed) / 100) / 10;
  const left = modelState(await modelStatus(panel)) !== 'ready';
  const mark = Date.now();
  await sleep(5_000);
  const late = session.requests.filter((r) => r.t > mark && WEIGHTS.test(r.url)).length;
  const ok = usable && left && late === 0;
  return result(
    name,
    ok ? 'pass' : 'fail',
    `Start usable again after ${usable ? `${answerS} s` : 'more than 10 s'}; left Ready: ${left}; weight requests after 5 s: ${late}`,
  );
}

/** After `idleMinutes` of waiting, one short question still gets an answer. */
async function idleCheck(panel: Page, args: EvalArgs): Promise<CheckResult> {
  const name = `Idle ${args.idleMinutes} min, then a question`;
  if (args.idleMinutes === 0) return result(name, 'skipped', '--idle 0');
  for (let minute = 0; minute < args.idleMinutes; minute++) {
    await sleep(60_000);
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  const seen = await ask(
    panel,
    args.scripted ? 'hello' : 'Hello, what can you do?',
    args.promptTimeoutS,
  );
  const ok = !seen.timedOut && seen.answer !== '';
  return result(name, ok ? 'pass' : 'fail', ok ? 'answered' : 'no answer after the idle wait');
}

/** Re-puts the first cached .wasm with one byte changed; false when none is cached. */
async function corruptCachedWasm(panel: Page): Promise<string | null> {
  return panel.evaluate(async () => {
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        if (!request.url.endsWith('.wasm')) continue;
        const response = await cache.match(request);
        if (!response) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
        await cache.put(request, new Response(bytes, { headers: response.headers }));
        return `${cacheName}\n${request.url}`;
      }
    }
    return null;
  });
}

async function dropCacheEntry(panel: Page, entry: string): Promise<void> {
  const [cacheName = '', url = ''] = entry.split('\n');
  await panel.evaluate(
    async ([c, u]) => (await caches.open(c ?? '')).delete(u ?? ''),
    [cacheName, url],
  );
}

async function integrityCheck(panel: Page, args: EvalArgs): Promise<CheckResult> {
  const name = 'Corrupted cached library is refused';
  const entry = await corruptCachedWasm(panel);
  if (entry === null)
    return result(name, 'skipped', 'no cached .wasm (scripted or library served from the package)');
  try {
    await panel.reload();
    await selectModel(panel, args.models.at(-1) ?? 'scripted');
    const start = await startModel(panel, args.startTimeoutMin);
    const refused = !start.ready && /integrity|hash|sha|digest|mismatch/i.test(start.status);
    return result(name, refused ? 'pass' : 'fail', start.status);
  } finally {
    await dropCacheEntry(panel, entry);
  }
}

/** The checks that need a ready model: `window` is the first Start; the idle check goes
 *  before the one that corrupts the cache. */
export async function runChecks(
  session: EvalSession,
  panel: Page,
  args: EvalArgs,
  window: Window,
): Promise<CheckResult[]> {
  return [
    await storageLevel(session),
    hostsCheck(session, window, args),
    await idleCheck(panel, args),
    await integrityCheck(panel, args),
  ];
}
