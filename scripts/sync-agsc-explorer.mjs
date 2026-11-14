// SPDX-License-Identifier: Apache-2.0
// Copies the graph explorer of the AgenticSystemCore.com site into third_party/agsc-explorer/
// unchanged and rewrites PINS.json (source path, the site repository's commit, size, SHA-256).
// Run it against the sibling site repository:
//   node scripts/sync-agsc-explorer.mjs <path-to-AgenticSystemCore.com>   (or set AGSC_SITE_REPO)
// Nothing is edited by hand in third_party/agsc-explorer/. The page markup is cut out of
// www/graph/index.html by cutMarkup (the two 3D attributes are left out; the 3D library is not shipped).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const TARGET = join(root, 'third_party/agsc-explorer');
export const COPIES = ['graph-data.js', 'graph-explorer.js', 'graph-explorer.css'];
const PAGE = 'www/graph/index.html';
const THREE_D = / data-gx-3d="[^"]*" data-gx-3d-integrity="[^"]*"/;

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The explorer block of the site page: from `<div class="gx gx-full"` to the "How it works" heading. */
export function cutMarkup(page) {
  const start = page.indexOf('<div class="gx gx-full"');
  const end = page.indexOf('<h2 id="how-it-works">');
  if (start < 0 || end < start) throw new Error('the explorer block was not found in the page');
  const block = page.slice(start, end).trimEnd();
  return { site: block, shipped: block.replace(THREE_D, '') };
}

const entry = (path, bytes, source) => ({
  file: path,
  bytes: bytes.length,
  sha256: sha256(bytes),
  source,
});

function main() {
  const site = process.argv[2] ?? process.env.AGSC_SITE_REPO;
  if (!site) throw new Error('give the path of the AgenticSystemCore.com repository');
  const commit = execFileSync('git', ['-C', site, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const files = COPIES.map((name) => {
    copyFileSync(join(site, 'assets', name), join(TARGET, name));
    return entry(name, readFileSync(join(TARGET, name)), `assets/${name}`);
  });
  const { site: original, shipped } = cutMarkup(readFileSync(join(site, PAGE), 'utf8'));
  writeFileSync(join(TARGET, 'explorer-markup.html'), `${shipped}\n`);
  const markup = {
    ...entry('explorer-markup.html', readFileSync(join(TARGET, 'explorer-markup.html')), PAGE),
    siteBlockSha256: sha256(original),
  };
  const forceGraph = JSON.parse(
    readFileSync(join(root, 'node_modules/force-graph/package.json'), 'utf8'),
  );
  const lib = readFileSync(join(root, 'node_modules/force-graph/dist/force-graph.min.js'));
  const pins = {
    sourceRepository: 'AgenticSystemCore.com',
    sourceCommit: commit,
    files: [...files, markup],
    forceGraph: {
      package: `force-graph@${forceGraph.version}`,
      ...entry('dist/force-graph.min.js', lib, 'npm: force-graph/dist/force-graph.min.js'),
      siteCopy: 'assets/vendor/force-graph-1.52.0.min.js',
    },
  };
  writeFileSync(join(TARGET, 'PINS.json'), `${JSON.stringify(pins, null, 2)}\n`);
  console.log(`pinned ${files.length + 2} files from commit ${commit}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
