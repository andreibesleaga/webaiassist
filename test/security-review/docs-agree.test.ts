// SPDX-License-Identifier: Apache-2.0
// Checks that the documents agree with the package: the commands they name exist, the commands
// ENGINEERING.md lists are all of them, every document is linked from the README, every relative
// link resolves, and the CHANGELOG heads with the version in package.json.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  version: string;
  scripts: Record<string, string>;
};
const docNames = readdirSync(join(ROOT, 'docs')).filter((name) => name.endsWith('.md'));
const publicDocs = ['README.md', 'CHANGELOG.md', ...docNames.map((name) => `docs/${name}`)];

/** The npm scripts a text runs: `npm run <name>` and the short forms `npm test` and `npm ci`. */
function scriptsNamedIn(text: string): string[] {
  const named = [...text.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map((match) => match[1] ?? '');
  return /npm test\b/.test(text) ? [...named, 'test'] : named;
}

describe('the documents name only commands that exist', () => {
  it.each(publicDocs)('%s', (path) => {
    const missing = scriptsNamedIn(read(path)).filter((name) => !(name in pkg.scripts));
    expect(missing).toEqual([]);
  });
});

describe('ENGINEERING.md lists every command of package.json', () => {
  it('has a table row for each script', () => {
    const listed = new Set(scriptsNamedIn(read('docs/ENGINEERING.md')));
    const unlisted = Object.keys(pkg.scripts).filter((name) => !listed.has(name));
    expect(unlisted).toEqual([]);
  });
});

describe('the README links every document of docs/', () => {
  it.each(docNames)('%s', (name) => {
    expect(read('README.md')).toContain(`(docs/${name})`);
  });
});

describe('every relative link of the documents resolves', () => {
  it.each(publicDocs)('%s', (path) => {
    const targets = [...read(path).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
      .map((match) => match[1] ?? '')
      .filter((target) => !/^[a-z]+:/i.test(target));
    const broken = targets.filter((target) => !existsSync(join(ROOT, dirname(path), target)));
    expect(broken).toEqual([]);
  });
});

describe('the CHANGELOG', () => {
  const changelog = read('CHANGELOG.md');

  it('heads with the version of package.json, unreleased or dated', () => {
    const first = /^## .*$/m.exec(changelog)?.[0] ?? '';
    const heading = new RegExp(
      `^## \\[${pkg.version.replace(/\./g, '\\.')}\\] - (not yet released|\\d{4}-\\d{2}-\\d{2})$`,
    );
    expect(first).toMatch(heading);
  });

  it('keeps no Unreleased section while the version is the first one', () => {
    expect(changelog).not.toMatch(/^## \[Unreleased\]/m);
  });
});
