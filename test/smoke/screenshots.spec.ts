// SPDX-License-Identifier: Apache-2.0
// The four store screenshots from the headless smoke build (scripted model, test page): the
// panel ready with its tools list, the question before a tool runs, an answer with a tool
// result, and the Options page. They are saved as docs/eval/screenshots/*-headless.png and
// only when WEBAIASSIST_SCREENSHOTS=1 (a GPU run takes the real ones: npm run eval:gpu).
// Run: npm run screenshots
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { webllmOptionCount } from './a11y-helpers';
import { openPanel, startSession, type Session } from './harness';

const DIR = join(process.cwd(), 'docs/eval/screenshots');
const shot = (name: string) => join(DIR, `${name}-headless.png`);

test.skip(
  process.env.WEBAIASSIST_SCREENSHOTS !== '1',
  'set WEBAIASSIST_SCREENSHOTS=1 to take them',
);

let session: Session;
test.beforeEach(async () => {
  session = await startSession();
});
test.afterEach(async () => {
  await session.close();
});

test('the four screenshots', async () => {
  const panel = await openPanel(session);
  await panel.setViewportSize({ width: 420, height: 860 });
  await panel.emulateMedia({ colorScheme: 'light' });
  await panel.click('#first-run-ok');
  await panel.selectOption('#model', 'scripted');
  await panel.click('#start');
  await expect(panel.locator('#model-status')).toHaveText('Ready: Scripted test model.');
  await panel.click('#tools-toggle');
  await panel.screenshot({ path: shot('1-status-ready') });

  await panel.click('#tools-toggle');
  await panel.fill('#question', '/tool add {"a": 2, "b": 3}');
  await panel.press('#question', 'Control+Enter');
  await panel.locator('#confirm-allow').click();
  await expect(panel.locator('#confirm-title')).toHaveText('Run the tool add?');
  await panel.screenshot({ path: shot('2-gate-dialog') });

  await panel.locator('#confirm-allow').click();
  await expect(panel.locator('#transcript li.assistant')).toHaveCount(1);
  await panel.screenshot({ path: shot('3-answer-untrusted') });

  const options = await session.context.newPage();
  await options.setViewportSize({ width: 760, height: 900 });
  await options.goto(`chrome-extension://${session.extensionId}/options.html`);
  await expect(options.locator('#webllm-model option')).toHaveCount(
    await webllmOptionCount(options),
  );
  await options.screenshot({ path: shot('4-options-page') });
});
