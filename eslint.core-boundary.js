// SPDX-License-Identifier: Apache-2.0
// The core-import rule: code under src/core imports no adapter, entry, spike or fake,
// and reads no browser global. tsconfig.core.json adds the type-level half of the rule.

const BROWSER_GLOBALS = [
  'chrome',
  'browser',
  'window',
  'document',
  'navigator',
  'self',
  'location',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
];

export const coreBoundary = {
  files: ['src/core/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '**/adapters/**',
              '**/entries/**',
              '**/spike/**',
              '**/fakes/**',
              '**/protocol/**',
            ],
            message: 'src/core must not import outside the core. Add a port instead.',
          },
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      ...BROWSER_GLOBALS.map((name) => ({
        name,
        message: 'src/core must not use browser APIs. Add a port instead.',
      })),
    ],
  },
};
