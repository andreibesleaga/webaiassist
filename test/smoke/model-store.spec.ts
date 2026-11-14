// SPDX-License-Identifier: Apache-2.0
// The model list of the Options page over the real WebLLM cache (the Cache API, scope
// "webllm/model"): a model whose files are stored is listed with its size, and Remove deletes
// them through WebLLM's own deleteModelAllInfoInCache. The weights are 5 MB of zeros here; no
// model is downloaded.
import { expect, test } from '@playwright/test';
import { startSession, type Session } from './harness';

// The pinned revision of src/adapters/webllm-app-config.ts; a new revision fails this test.
const MODEL_URL =
  'https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC/resolve/8c14ce481d4c692769976ad52afea453a102df19/';
const SHARD_BYTES = 5_000_000;

let session: Session;
test.beforeAll(async () => {
  session = await startSession();
});
test.afterAll(async () => {
  await session.close();
});

test('Options lists a graphics-card model from WebLLM’s cache with its size, and removes it', async () => {
  const options = await session.context.newPage();
  await options.goto(`chrome-extension://${session.extensionId}/options.html`);
  await expect(options.locator('#model-store-empty')).toBeVisible();
  await options.evaluate(
    async ({ url, bytes }) => {
      const cache = await caches.open('webllm/model');
      const index = { records: [{ dataPath: 'params_shard_0.bin' }] };
      await cache.put(`${url}tensor-cache.json`, new Response(JSON.stringify(index)));
      const headers = { 'content-length': String(bytes) };
      await cache.put(`${url}params_shard_0.bin`, new Response(new Uint8Array(bytes), { headers }));
    },
    { url: MODEL_URL, bytes: SHARD_BYTES },
  );
  await options.reload();
  await expect(options.locator('#model-store li')).toHaveCount(1);
  await expect(options.locator('#model-store')).toContainText(
    'Qwen3 0.6B on the graphics card: 5 MB',
  );
  await options.getByRole('button', { name: /^Remove Qwen3 0\.6B on the graphics card/ }).click();
  await expect(options.locator('#options-status')).toHaveText(
    'Removed Qwen3 0.6B on the graphics card; 5 MB freed.',
  );
  await expect(options.locator('#model-store-empty')).toBeVisible();
  const left = await options.evaluate(
    async () => (await (await caches.open('webllm/model')).keys()).length,
  );
  expect(left).toBe(0);
});
