// SPDX-License-Identifier: Apache-2.0
// Copies the query engine files of agentic-system-core 1.1.0 into third_party/agsc-query/ unchanged
// and rewrites PINS.json (source path, size, SHA-256, the engine repository's commit and tag).
// Run it against the sibling engine repository:
//   node scripts/sync-agsc-query.mjs <path-to-agentic-system-core>   (or set AGSC_ENGINE_REPO)
// Nothing is edited by hand in third_party/agsc-query/.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const TARGET = join(root, 'third_party/agsc-query');
/** [file name here, path in the engine repository]. */
export const COPIES = [
  ['tokens.js', 'src/distribution/query/tokens.js'],
  ['engine.js', 'src/distribution/query/engine.js'],
  ['view.js', 'src/distribution/query/view.js'],
  ['ontology-questions.json', 'docs/ontology-questions.json'],
];
export const TAG = 'v1.1.0';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const git = (repo, ...args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

/** The oxigraph files: web.js is bundled into the worker, the wasm is pinned in scripts/model-libs.json. */
function oxigraphPin() {
  const dir = join(root, 'node_modules/oxigraph');
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const entry = (name) => {
    const bytes = readFileSync(join(dir, name));
    return { bytes: bytes.length, sha256: sha256(bytes) };
  };
  return { package: `oxigraph@${version}`, webJs: entry('web.js'), wasm: entry('web_bg.wasm') };
}

function main() {
  const repo = process.argv[2] ?? process.env.AGSC_ENGINE_REPO;
  if (!repo) throw new Error('give the path of the agentic-system-core repository');
  const files = COPIES.map(([file, source]) => {
    // Read from the tag, so a later change in the working tree cannot get in.
    const bytes = execFileSync('git', ['-C', repo, 'show', `${TAG}:${source}`]);
    writeFileSync(join(TARGET, file), bytes);
    return { file, bytes: bytes.length, sha256: sha256(bytes), source };
  });
  const pins = {
    sourceRepository: 'agentic-system-core',
    sourceTag: TAG,
    sourceTagCommit: git(repo, 'rev-list', '-n', '1', TAG),
    sourceHeadCommit: git(repo, 'rev-parse', 'HEAD'),
    files,
    oxigraph: oxigraphPin(),
  };
  writeFileSync(join(TARGET, 'PINS.json'), `${JSON.stringify(pins, null, 2)}\n`);
  console.log(`pinned ${files.length} files from ${TAG}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
