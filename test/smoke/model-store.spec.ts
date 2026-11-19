// SPDX-License-Identifier: Apache-2.0
// The model list of the Options page over the stored model files. A model offered on the
// graphics card and on the processor is one file: it is listed once, under its plain name, with
// its size, and Remove deletes it. The test build keeps its "files" in localStorage
// (src/fakes/fake-wllama-engine.ts), so the file here is a record of the real size; no model is
// downloaded.
import { expect, test } from '@playwright/test';
import { startSession, type Session } from './harness';

// The pinned file of Qwen3 0.6B in src/adapters/cpu-models.ts; a new pin fails this test.
const MODEL_URL =
  'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf';
const MODEL_BYTES = 396_705_472;
const DISK_KEY = 'webaiassist.fake-cpu-disk';

let session: Session;
test.beforeAll(async () => {
  session = await startSession();
});
test.afterAll(async () => {
  await session.close();
});

test('Options lists a stored model file once with its size, and removes it', async () => {
  const options = await session.context.newPage();
  await options.goto(`chrome-extension://${session.extensionId}/options.html`);
  await expect(options.locator('#model-store-empty')).toBeVisible();
  await options.evaluate(
    ({ key, url, bytes }) => {
      const disk = { [url]: { bytes, hash: 'a'.repeat(64), checked: true } };
      localStorage.setItem(key, JSON.stringify({ disk, drops: {} }));
    },
    { key: DISK_KEY, url: MODEL_URL, bytes: MODEL_BYTES },
  );
  await options.reload();
  await expect(options.locator('#model-store li')).toHaveCount(1);
  await expect(options.locator('#model-store')).toContainText('Qwen3 0.6B: 397 MB');
  await options.getByRole('button', { name: /^Remove Qwen3 0\.6B/ }).click();
  await expect(options.locator('#options-status')).toHaveText('Removed Qwen3 0.6B; 397 MB freed.');
  await expect(options.locator('#model-store-empty')).toBeVisible();
  const left = await options.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as { disk?: object };
    return Object.keys(saved.disk ?? {}).length;
  }, DISK_KEY);
  expect(left).toBe(0);
});
