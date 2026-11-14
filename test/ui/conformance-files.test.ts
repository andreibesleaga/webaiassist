// SPDX-License-Identifier: Apache-2.0
// The conformance/ folder as files: expect.json agrees with the case scripts and index.html, and no
// file uses what would stop the folder being served unchanged from a sub-path (an absolute path, an
// outside host) or what writes HTML into a page.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandNames, listedOf, loadExpect } from '../../scripts/eval/conformance-expect.ts';

const ROOT = join(process.cwd(), 'conformance');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const expectFile = loadExpect();
const ids = Object.keys(expectFile.cases);
const index = read('index.html');
const caseFiles = readdirSync(join(ROOT, 'cases')).sort();
const allFiles = [
  'index.html',
  'harness.js',
  'list-tools.js',
  'conformance.css',
  'frames/inner.html',
  'frames/inner.js',
  ...caseFiles.map((name) => `cases/${name}`),
];

describe('expect.json', () => {
  it('lists the cases c01 to c16, in order', () => {
    expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`));
  });

  it('has a title, tools and an allowed self result for every case', () => {
    for (const [id, c] of Object.entries(expectFile.cases)) {
      expect(c.title, id).not.toBe('');
      expect(c.tools.length, id).toBeGreaterThan(0);
      expect(c.selfStatus.length, id).toBeGreaterThan(0);
      for (const status of c.selfStatus) expect(['pass', 'unsupported']).toContain(status);
    }
  });

  it('lists only tools the page registers, and calls only listed tools', () => {
    for (const [id, c] of Object.entries(expectFile.cases)) {
      const tools = expandNames(c.tools);
      expect(new Set(tools).size, `${id} names are unique`).toBe(tools.length);
      const later = (c.page ?? []).flatMap((action) => expandNames(action.listed));
      for (const name of listedOf(c)) {
        expect([...tools, ...later], `${id} lists ${name}`).toContain(name);
      }
      for (const call of c.calls ?? []) {
        expect(listedOf(c), `${id} calls ${call.tool}`).toContain(call.tool);
        expect(typeof call.confirm).toBe('boolean');
        expect(call.shows.length, `${id} ${call.tool} shows something`).toBeGreaterThan(0);
      }
    }
  });

  it('names only buttons that the case script creates', () => {
    for (const [id, c] of Object.entries(expectFile.cases)) {
      const source = read(`cases/${caseFiles.find((f) => f.startsWith(id)) ?? ''}`);
      const clicks = [
        ...(c.page ?? []).map((action) => action.click),
        ...(c.calls ?? []).flatMap((call) => [
          call.whileWaiting?.click,
          call.duringQuestion?.click,
        ]),
      ].filter((click): click is string => click !== undefined);
      for (const click of clicks) {
        const name = click.replace(/^#/, '').split(' ')[0] ?? '';
        expect(source, `${id} ${click}`).toContain(name);
      }
    }
  });
});

describe('the case scripts', () => {
  it('are exactly the files index.html loads, one per case, and exist', () => {
    const loaded = [...index.matchAll(/<script src="(cases\/[^"]+)"/g)].map((m) => m[1]);
    expect(loaded).toEqual(caseFiles.map((name) => `cases/${name}`));
    expect(caseFiles.map((name) => name.slice(0, 3))).toEqual(ids);
    for (const file of loaded) expect(existsSync(join(ROOT, file ?? ''))).toBe(true);
  });

  it('each register an id, the same title as expect.json and a specification link', () => {
    for (const name of caseFiles) {
      const id = name.slice(0, 3);
      const source = read(`cases/${name}`);
      expect(source, name).toContain(`id: '${id}'`);
      expect(source, name).toContain(`title: '${expectFile.cases[id]?.title}'`);
      expect(source, name).toMatch(/spec: c\.links\.(spec|imperative|declarative|secure)/);
      expect(source, name).toContain('summary:');
    }
  });
});

describe('every file of the folder', () => {
  it('writes no HTML into the page and runs no string as code', () => {
    for (const file of allFiles) {
      expect(read(file), file).not.toMatch(
        /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/,
      );
    }
  });

  it('uses relative addresses only, so a sub-path of a static host serves it unchanged', () => {
    for (const file of allFiles.filter((f) => /\.(html|css)$/.test(f))) {
      expect(read(file), file).not.toMatch(/(?:src|href)="\//);
      expect(read(file), file).not.toMatch(/url\(\s*['"]?\//);
    }
    for (const file of allFiles.filter((f) => f.endsWith('.js'))) {
      expect(read(file), file).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
    }
  });

  it('names no outside host except the specifications it links and an invalid test address', () => {
    const allowed = new Set([
      'webmachinelearning.github.io',
      'developer.chrome.com',
      'example.invalid',
    ]);
    for (const file of allFiles) {
      for (const match of read(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        expect(allowed.has((match[1] ?? '').toLowerCase()), `${file}: ${match[0]}`).toBe(true);
      }
    }
  });

  it('loads no script or stylesheet from outside the folder', () => {
    const sources = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '');
    for (const source of sources.filter((s) => !s.startsWith('?'))) {
      expect(source, source).toMatch(/^(cases\/|harness\.js|list-tools\.js|conformance\.css)/);
    }
  });

  it('says on the page that nothing is sent anywhere', () => {
    expect(index).toContain('sends nothing anywhere');
    expect(index).toContain('independent of any browser extension');
  });

  it('is not part of the extension package', () => {
    for (const file of ['scripts/build.mjs', 'scripts/zip.mjs']) {
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).not.toContain('conformance');
    }
  });
});
