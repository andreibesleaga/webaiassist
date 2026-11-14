// SPDX-License-Identifier: Apache-2.0
// Playwright runs only the extension smoke test (test/smoke). Run: npm run test:smoke.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/smoke',
  testMatch: '*.spec.ts',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
});
