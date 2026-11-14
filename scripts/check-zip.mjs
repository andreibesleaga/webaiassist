// SPDX-License-Identifier: Apache-2.0
// Content test of webaiassist-<version>.zip, the file that is uploaded to the Chrome Web
// Store and attached to the GitHub release: exactly the files of dist/, manifest.json at
// the root with the package version and the documented permissions, no source maps, no
// scripted test model, no remotely hosted code, no development-only file (spike page,
// ?tab= override), the pinned model libraries, and a size
// limit (a jump in size means something unplanned got in). Run: npm run check:zip.
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtFiles, checkBundles, checkDevOnly, checkManifest } from './check-dist.mjs';
import { checkModelLibFiles, checkRemoteCode } from './check-remote-code.mjs';
import { MODEL_LIBS } from './model-libs.mjs';
import { zipName } from './zip.mjs';

/** The 0.1.0 zip is about 11.3 MB: the four model libraries and the llama.cpp engine (five compressed .wasm files) held most of it (9.3 MiB), and the query engine (oxigraph, 1.5 MB compressed wasm, plus the explorer and query code) is a planned addition of the graph tools. The limit is 12 MiB, a margin of about 0.7 MiB; raise it only for another planned addition (a jump in size means something unplanned got in). */
export const MAX_ZIP_BYTES = 12 * 1024 * 1024;

function listProblems(paths, distFiles) {
  const problems = [];
  for (const path of paths) {
    if (/\.map$/.test(path)) problems.push(`${path} is a source map`);
    else if (!distFiles.includes(path)) problems.push(`${path} is not in the build`);
  }
  for (const path of distFiles) if (!paths.includes(path)) problems.push(`${path} is missing`);
  return problems;
}

function manifestProblems(entries, version) {
  const raw = entries['manifest.json'];
  if (raw === undefined) return ['manifest.json is not at the root of the zip'];
  const manifest = JSON.parse(strFromU8(raw));
  const problems = checkManifest(manifest, (path) => path in entries, 'release');
  if (manifest.version !== version) {
    problems.push(`manifest has version ${manifest.version}, not ${version}`);
  }
  return problems;
}

function textProblems(entries) {
  const texts = {};
  for (const [path, bytes] of Object.entries(entries)) {
    if (/\.(js|html)$/.test(path)) texts[path] = strFromU8(bytes);
  }
  const maps = Object.entries(texts)
    .filter(([, text]) => /sourceMappingURL=/.test(text))
    .map(([path]) => `${path} has a source-map comment`);
  return [
    ...checkBundles(texts, 'release'),
    ...checkRemoteCode(texts),
    ...checkDevOnly(Object.keys(entries), texts),
    ...maps,
  ];
}

/** All problems of a zip given as its entries (path -> bytes); empty means it is fine. */
export function checkZip({ entries, size, version, distFiles, pins = MODEL_LIBS }) {
  const paths = Object.keys(entries);
  const problems = [
    ...listProblems(paths, distFiles),
    ...manifestProblems(entries, version),
    ...textProblems(entries),
    ...checkModelLibFiles(paths, (path) => entries[path], pins),
  ];
  if (size > MAX_ZIP_BYTES) problems.push(`zip has ${size} bytes; the limit is ${MAX_ZIP_BYTES}`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const file = join(root, zipName(version));
  const entries = unzipSync(readFileSync(file));
  const size = statSync(file).size;
  const problems = checkZip({ entries, size, version, distFiles: builtFiles(join(root, 'dist')) });
  if (problems.length > 0) {
    console.error(`${zipName(version)}: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  const count = Object.keys(entries).length;
  console.log(`${zipName(version)}: OK (${count} files, ${size} bytes, version ${version})`);
}
