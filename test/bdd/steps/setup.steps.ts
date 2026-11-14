// SPDX-License-Identifier: Apache-2.0
// Given steps: the browser with the extension, the page under test, the side panel, the
// Options page and the scripted model.
import { expect, type Page } from '@playwright/test';
import {
  activeTab,
  openPanelFor,
  openBoomPage,
  openPlainPage,
  openStubPage,
  type Session,
} from '../../smoke/harness';
import { withFakeModel, type FakeModelConfig } from '../../smoke/fake-language-model';
import type { World } from '../world';
import { ensureSite } from './site-helpers';
import { Given } from './fixtures';

async function recordRequests(world: World): Promise<void> {
  (await world.session()).context.on('request', (request) => world.requests.push(request.url()));
}

async function open(world: World, opener: (s: Session) => Promise<{ page: Page; tabId: number }>) {
  const { page, tabId } = await opener(await world.session());
  world.page = page;
  world.tabId = tabId;
}

Given('WebAIAssist is installed', async ({ world }) => {
  await world.session();
});

Given('network requests are recorded', async ({ world }) => {
  await recordRequests(world);
});

Given('this browser has no built-in model', ({ world }) => {
  world.noBuiltInModel = true;
});

const SCRIPTED_ANSWER = '{"answer":"You can add numbers and echo text."}';

function scriptedBuiltIn(world: World, change: Partial<FakeModelConfig>): void {
  world.builtIn = {
    state: 'available',
    contextWindow: 9216,
    replies: [SCRIPTED_ANSWER],
    ...world.builtIn,
    ...change,
  };
}

Given(
  'the scripted built-in model reports a context of {int} tokens',
  ({ world }, tokens: number) => {
    scriptedBuiltIn(world, { contextWindow: tokens });
  },
);

Given('the scripted built-in model must download and the download never ends', ({ world }) => {
  scriptedBuiltIn(world, { state: 'downloadable', downloadMs: 'forever' });
});

Given('the scripted built-in model must download and the network fails', ({ world }) => {
  scriptedBuiltIn(world, {
    state: 'downloadable',
    failCreate: { name: 'NetworkError', message: 'Failed to download' },
  });
});

Given('a page with two WebMCP tools is open', async ({ world }) => {
  await open(world, (session) => openStubPage(session));
});

Given(
  'a page with two WebMCP tools is open on a site that is not allowed yet',
  async ({ world }) => {
    world.notAllowedYet = true;
    await open(world, (session) => openStubPage(session, session.localOrigin));
  },
);

Given('a page whose tool "boom" always throws is open', async ({ world }) => {
  await open(world, (session) => openBoomPage(session));
});

Given('a page without WebMCP tools is open', async ({ world }) => {
  await open(world, (session) => openPlainPage(session));
});

Given('a browser page is open', async ({ world }) => {
  await open(world, async (session) => {
    const page = await session.context.newPage();
    await page.goto('chrome://version');
    return activeTab(session, page);
  });
});

Given('the side panel is open on that page', async ({ world }) => {
  if (world.tabId === undefined) throw new Error('open a page first');
  const noBuiltIn = async (panel: Page): Promise<void> => {
    await panel.addInitScript(() => {
      delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
    });
  };
  const before = world.builtIn
    ? withFakeModel(world.builtIn)
    : world.noBuiltInModel
      ? noBuiltIn
      : undefined;
  world.panel = await openPanelFor(await world.session(), world.tabId, before);
  world.focusOn('panel');
});

Given('the scripted model is ready', async ({ world }) => {
  if (!world.panel) await ensureSite(world);
  const panel = world.requirePanel();
  await panel.selectOption('#model', 'scripted');
  await panel.click('#start');
  await expect(panel.locator('#model-status')).toHaveText('Ready: Scripted test model.');
});

/** The model line texts the panel showed since a mark, kept in the page by an observer. */
export async function watchModelLine(panel: Page): Promise<void> {
  await panel.evaluate(() => {
    const seen: string[] = [];
    const facts: { cancelShown: boolean; progress: number }[] = [];
    const w = window as unknown as { __modelLines: string[]; __modelFacts: typeof facts };
    w.__modelLines = seen;
    w.__modelFacts = facts;
    const line = document.getElementById('model-status') as HTMLElement;
    const progress = document.getElementById('progress') as HTMLProgressElement;
    const cancel = document.getElementById('cancel-load') as HTMLElement;
    // Each line comes with what the bar and the Cancel button showed at that moment.
    new MutationObserver(() => {
      seen.push(line.textContent ?? '');
      facts.push({ cancelShown: !cancel.hidden, progress: progress.value });
    }).observe(line, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

export async function chooseCpu(world: World, value: string): Promise<void> {
  const panel = world.requirePanel();
  await expect(panel.locator(`#model option[value="${value}"]`)).toHaveCount(1);
  await panel.selectOption('#model', value);
  await watchModelLine(panel);
}

/** Presses Start on a model that is not on this computer and agrees to the download. */
export async function startAndAgree(panel: Page): Promise<void> {
  await panel.click('#start');
  const agree = panel.locator('#consent-ok');
  await agree.waitFor({ state: 'visible', timeout: 5_000 });
  await agree.click();
}

/** Presses Start, agrees to the download, and waits for the model line to say Ready. */
async function startAndWait(world: World): Promise<void> {
  const panel = world.requirePanel();
  await startAndAgree(panel);
  await expect(panel.locator('#model-status')).toContainText('Ready: ', { timeout: 30_000 });
}

/** Closes the offscreen document: the model host and everything in its memory is gone, as after
 *  a restart of the browser; the stored files stay. */
export async function restartModelHost(world: World): Promise<void> {
  const session = await world.session();
  await session.worker.evaluate(async () => {
    if (
      (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] as never })).length
    )
      await chrome.offscreen.closeDocument();
  });
}

Given('the CPU model is downloaded', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu');
  await startAndWait(world);
  await restartModelHost(world);
});

Given('the CPU model was downloaded earlier', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu');
  await startAndWait(world);
});

Given('the model host serves a file with the wrong SHA-256', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu-bad-sum');
});

Given('the connection drops during the download', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu-drop');
  await startAndAgree(world.requirePanel());
});

Given('the computer cannot give the CPU model enough memory', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu-big');
});

async function openOptions(world: World): Promise<void> {
  const session = await world.session();
  await world.options?.close();
  world.options = await session.context.newPage();
  await world.options.goto(`chrome-extension://${session.extensionId}/options.html`);
  await expect(world.options.locator('#webllm-model option')).not.toHaveCount(0);
  world.focusOn('options');
}

Given('the Options page is open', async ({ world }) => {
  await openOptions(world);
});

Given('the option {string} is saved', async ({ world }, label: string) => {
  await openOptions(world);
  const options = world.options as Page;
  await options.getByLabel(label, { exact: true }).check();
  await options.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(options.locator('#options-status')).toHaveText('Saved.');
  await options.close();
  world.options = undefined;
  world.focusOn('panel');
});

export { openOptions };
