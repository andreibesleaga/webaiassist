// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
