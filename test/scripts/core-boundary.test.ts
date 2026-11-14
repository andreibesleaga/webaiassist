// SPDX-License-Identifier: Apache-2.0
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { coreBoundary } from '../../eslint.core-boundary.js';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
    coreBoundary,
  ],
});

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error');
}

describe('the core-import rule', () => {
  it('refuses an adapter import inside src/core', async () => {
    const ids = await ruleIds(
      "import { x } from '../adapters/indexeddb-memory';\n",
      'src/core/a.ts',
    );
    expect(ids).toEqual(['no-restricted-imports']);
  });

  it('refuses entries, spike, fakes and protocol imports inside src/core', async () => {
    for (const from of [
      '../entries/sidepanel',
      '../spike/spike',
      '../fakes/fixed-clock',
      '../protocol/messages',
    ]) {
      expect(await ruleIds(`import { x } from '${from}';\n`, 'src/core/a.ts')).toEqual([
        'no-restricted-imports',
      ]);
    }
  });

  it('refuses browser globals inside src/core', async () => {
    const code = 'export const a = chrome.runtime.id + document.title + navigator.gpu;\n';
    expect(await ruleIds(code, 'src/core/a.ts')).toEqual([
      'no-restricted-globals',
      'no-restricted-globals',
      'no-restricted-globals',
    ]);
  });

  it('allows imports inside the core', async () => {
    expect(await ruleIds("import { parseAction } from './action';\n", 'src/core/a.ts')).toEqual([]);
  });

  it('does not apply outside src/core', async () => {
    const code =
      "import { x } from '../adapters/indexeddb-memory';\nexport const a = chrome.runtime.id;\n";
    expect(await ruleIds(code, 'src/entries/a.ts')).toEqual([]);
  });
});
