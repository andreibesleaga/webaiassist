// SPDX-License-Identifier: Apache-2.0
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The copied query files (third_party/agsc-query) are CommonJS; vite-node cannot run those as they are,
// so a test reads them through Node's own require (test/helpers/agsc-query/*.ts, same bytes).
const agscQuery = fileURLToPath(new URL('test/helpers/agsc-query/', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^.*\/agsc-query\/(engine|view|tokens)\.js$/, replacement: `${agscQuery}$1.ts` },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/entries/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: {
        'src/core/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
