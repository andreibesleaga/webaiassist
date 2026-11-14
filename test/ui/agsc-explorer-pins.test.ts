// SPDX-License-Identifier: Apache-2.0
// The site's graph explorer is copied, not rewritten: every copied file must equal its pin, the
// markup inside static/explorer.html must equal the pinned markup, and force-graph must be the
// pinned bytes. No network and no sibling repository needed. A second test compares the pins with
// the site's current files when AGSC_SITE_REPO points at the site repository.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  explorerFiles,
  explorerProblems,
  PINS,
  PINS_DIR,
  pinProblems,
} from '../../scripts/explorer-pins.mjs';
import { cutMarkup } from '../../scripts/sync-agsc-explorer.mjs';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('the copied explorer files equal their pins', () => {
  it('has no problem: size and SHA-256 of every copy and of force-graph', () => {
    expect(explorerProblems()).toEqual([]);
  });

  it('pins the site files, the markup and force-graph, with the site commit', () => {
    expect(PINS.files.map((file) => file.file)).toEqual([
      'graph-data.js',
      'graph-explorer.js',
      'graph-explorer.css',
      'explorer-markup.html',
    ]);
    expect(PINS.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(PINS.forceGraph.package).toBe('force-graph@1.52.0');
    expect(PINS.forceGraph.sha256).toBe(
      'f59db59ba92ff5a76ed93d7a4d77a703b176260e5d9cd29f4f8eb4f6c369a629',
    );
  });

  it('notices a changed byte, a different size and a missing file', () => {
    const [pin] = explorerFiles();
    if (!pin) throw new Error('no pin');
    const bytes = readFileSync(pin.from);
    expect(pinProblems(pin, bytes)).toEqual([]);
    const changed = Buffer.from(bytes);
    changed[0] = (changed[0] ?? 0) ^ 1;
    expect(pinProblems(pin, changed)[0]).toMatch(/SHA-256/);
    expect(pinProblems(pin, bytes.subarray(1))[0]).toMatch(/bytes, not/);
    expect(pinProblems(pin, undefined)[0]).toMatch(/missing/);
  });

  it('knows where the build puts each file, in the site’s own folder layout', () => {
    expect(explorerFiles().map((file) => file.to)).toEqual([
      'explorer-vendor/assets/graph-data.js',
      'explorer-vendor/assets/graph-explorer.js',
      'explorer-vendor/assets/graph-explorer.css',
      'explorer-vendor/assets/vendor/force-graph-1.52.0.min.js',
    ]);
  });
});

describe('the markup of the explorer page', () => {
  const markup = read('third_party/agsc-explorer/explorer-markup.html');

  it('is the pinned markup, byte for byte, between the two marks of static/explorer.html', () => {
    const page = read('static/explorer.html');
    const begin = '<!-- site explorer markup: begin -->\n';
    const inner = page.slice(
      page.indexOf(begin) + begin.length,
      page.indexOf('\n<!-- site explorer markup: end -->'),
    );
    expect(inner).toBe(markup.trimEnd());
    const pin = PINS.files.find((file) => file.file === 'explorer-markup.html');
    expect(sha256(Buffer.from(markup))).toBe(pin?.sha256);
  });

  it('is cut from the site page without the 3D attributes, and keeps every control the code needs', () => {
    const page = `<main><div class="gx gx-full" data-gx="full" data-gx-3d="/a.js" data-gx-3d-integrity="sha384-x" hidden><b id="gx-d-3"></b></div>\n<h2 id="how-it-works">`;
    const cut = cutMarkup(page);
    expect(cut.shipped).not.toContain('data-gx-3d');
    expect(cut.site).toContain('data-gx-3d');
    for (const id of [
      'gx-q',
      'gx-d-2',
      'gx-d-3',
      'gx-rotate',
      'gx-depth',
      'gx-src',
      'gx-load',
      'gx-fit',
    ]) {
      expect(markup, id).toContain(`id="${id}"`);
    }
    expect(markup).not.toContain('data-gx-3d');
    expect(() => cutMarkup('<p>no explorer</p>')).toThrow(/not found/);
  });

  it('is the block the site page has now, when the site repository is at hand', () => {
    const site = process.env.AGSC_SITE_REPO;
    if (!site) return;
    const block = cutMarkup(readFileSync(join(site, 'www/graph/index.html'), 'utf8'));
    expect(sha256(Buffer.from(block.site)), 'run: node scripts/sync-agsc-explorer.mjs').toBe(
      PINS.files.find((file) => file.file === 'explorer-markup.html')?.siteBlockSha256,
    );
  });
});

describe('the pins against the site repository (set AGSC_SITE_REPO to run)', () => {
  const site = process.env.AGSC_SITE_REPO;
  it.runIf(site !== undefined && existsSync(site))(
    'are the site’s current files and commit',
    () => {
      const root = site ?? '';
      for (const file of PINS.files.filter(
        (item) => item.file.endsWith('.js') || item.file.endsWith('.css'),
      )) {
        const current = readFileSync(join(root, 'assets', file.file));
        expect(sha256(current), `${file.file}: run node scripts/sync-agsc-explorer.mjs`).toBe(
          file.sha256,
        );
      }
      const vendored = readFileSync(join(root, 'assets/vendor/force-graph-1.52.0.min.js'));
      expect(sha256(vendored)).toBe(PINS.forceGraph.sha256);
      const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
      expect(
        commit,
        'the pins are from an older commit of the site: sync if the files changed',
      ).toMatch(/^[0-9a-f]{40}$/);
    },
  );

  it('keep PINS.json in the folder the build reads', () => {
    expect(existsSync(join(PINS_DIR, 'PINS.json'))).toBe(true);
  });
});
