// SPDX-License-Identifier: Apache-2.0
// Smoke test of the built extension (dist-smoke/, set-up in harness.ts): one question
// answered by the scripted test model through the confirmation gate on a WebMCP page.
import { expect, test } from '@playwright/test';
import { openPanel, startSession } from './harness';

test('one question with the scripted model goes through the gate on a WebMCP page', async () => {
  const session = await startSession();
  const { origin } = session;
  try {
    const panel = await openPanel(session);
    await expect(panel.locator('#page-status')).toHaveText(
      `${new URL(origin).host} — 2 WebMCP tools`,
    );

    await panel.selectOption('#model', 'scripted');
    await panel.click('#start');
    await expect(panel.locator('#model-status')).toHaveText('Ready: Scripted test model.');

    await panel.fill('#question', '/tool add {"a": 2, "b": 3}');
    await panel.press('#question', 'Control+Enter');
    await expect(panel.locator('#confirm-title')).toHaveText(`Use the tools of ${origin}?`);
    await panel.click('#confirm-allow');
    await expect(panel.locator('#confirm-title')).toHaveText('Run the tool add?');
    await expect(panel.locator('#confirm-body')).toContainText(`Site: ${origin}`);
    await expect(panel.locator('#confirm-body')).toContainText('"a": 2');
    await expect(panel.locator('#confirm-deny')).toBeFocused();
    await panel.click('#confirm-allow');

    await expect(panel.locator('#transcript')).toContainText('The tool said: 5');
    await expect(panel.locator('#transcript [data-trust="untrusted"]')).toHaveCount(1);
  } finally {
    await session.close();
  }
});

test('the model engine loads from inside the package and matches its pin', async () => {
  const session = await startSession();
  try {
    const panel = await openPanel(session);
    const report = await panel.evaluate(async () => {
      const response = await fetch('model-libs/wllama.wasm');
      const bytes = await response.arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
      const { quota, usage } = await navigator.storage.estimate();
      return { ok: response.ok, hex, quota: quota ?? 0, usage: usage ?? 0 };
    });
    expect(report.ok).toBe(true);
    // The pin of scripts/model-libs.json for @wllama/wllama 3.8.1.
    expect(report.hex).toBe('551f13439366eff11e057b1b91fe46a7fdac29d56d67372d4c5f19a549dfe70c');
    // Recorded, not a gate: the storage the extension may use without unlimitedStorage.
    console.log(`storage quota of the extension: ${(report.quota / 1024 ** 3).toFixed(1)} GiB`);
  } finally {
    await session.close();
  }
});
