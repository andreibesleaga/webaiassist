// SPDX-License-Identifier: Apache-2.0
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { coreBoundary } from './eslint.core-boundary.js';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dist-smoke/',
      'dist-eval/',
      'vendor/',
      'third_party/',
      'test-results/',
      '.features-gen/',
      'playwright-report/',
      'coverage/',
      'node_modules/',
      '.claude/',
      'src/protocol/validators.generated.js',
      'src/protocol/validators.generated.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      complexity: ['error', 10],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines': ['error', { max: 300 }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
  coreBoundary,
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
