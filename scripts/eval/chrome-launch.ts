// SPDX-License-Identifier: Apache-2.0
// Starts Google Chrome (not Playwright's Chromium) with the flags of nano-plan.ts#chromeArgs, as
// `npm run eval:nano` and `npm run eval:conformance` need it. Chrome has its own model service and
// WebMCP switches, and accepts an unpacked extension only over the debugging pipe, so the extension
// (when there is one) goes in with the DevTools command Extensions.loadUnpacked.
import { chromium, type BrowserContext } from '@playwright/test';
import { chromeArgs } from './nano-plan.ts';

export interface ChromeLaunch {
  /** The browser profile folder; kept between runs. */
  readonly profile: string;
  /** An unpacked extension to load (dist-eval/), or none for a browser-only run. */
  readonly extension?: string;
}

export interface Launched {
  readonly context: BrowserContext;
  readonly extensionId?: string;
}

export async function launchChrome(options: ChromeLaunch): Promise<Launched> {
  const context = await chromium.launchPersistentContext(options.profile, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    ignoreDefaultArgs: true,
    args: chromeArgs(options.profile),
  });
  if (options.extension === undefined) return { context };
  const browser = context.browser();
  if (!browser) throw new Error('no browser handle: cannot load the extension');
  const cdp = await browser.newBrowserCDPSession();
  const loaded = (await cdp.send(
    'Extensions.loadUnpacked' as never,
    { path: options.extension } as never,
  )) as {
    id: string;
  };
  return { context, extensionId: loaded.id };
}
