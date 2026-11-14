// SPDX-License-Identifier: Apache-2.0
// Steps of feature 18: Chrome stops the extension's background worker and starts it again.
import { expect } from '@playwright/test';
import type { World } from '../world';
import { When, Then } from './fixtures';
import { watchModelLine } from './setup.steps';

interface WorkerVersions {
  versions: { scriptURL: string; runningStatus: string }[];
}

/** Stops the extension's service worker the way Chrome does when it is idle, and waits until
 *  Chrome reports it stopped. The next message to the extension starts it again. */
async function stopServiceWorker(world: World): Promise<void> {
  const session = await world.session();
  const page = world.page ?? world.requirePanel();
  const cdp = await session.context.newCDPSession(page);
  const stopped = new Promise<void>((resolve) => {
    cdp.on('ServiceWorker.workerVersionUpdated', (event: WorkerVersions) => {
      const ours = event.versions.some((v) => v.scriptURL.includes(session.extensionId));
      const idle = event.versions.some((v) => v.runningStatus === 'stopped');
      if (ours && idle) resolve();
    });
  });
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await stopped;
  await cdp.detach();
}

When('the background worker is stopped', async ({ world }) => {
  await stopServiceWorker(world);
  await watchModelLine(world.requirePanel());
});

Then('no download was made since the worker stopped', async ({ world }) => {
  const lines = await world
    .requirePanel()
    .evaluate(() => (window as unknown as { __modelLines?: string[] }).__modelLines ?? []);
  expect(lines.filter((line) => line.startsWith('Downloading'))).toEqual([]);
});
