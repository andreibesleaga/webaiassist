// SPDX-License-Identifier: Apache-2.0
// The BDD run: every scenario in features/ that is @smoke and not waiting for a later work
// package (see docs/SCENARIOS.md), against the smoke-test build with the scripted model.
// Run: npm run test:bdd. The generated Playwright files are in .features-gen/ (not committed).
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { BDD_TAG_EXPRESSION } from './scripts/scenarios.mjs';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'test/bdd/steps/*.ts',
  tags: BDD_TAG_EXPRESSION,
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
});
