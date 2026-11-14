// SPDX-License-Identifier: Apache-2.0
// Packs dist/ into webaiassist-<version>.zip at the repository root, with manifest.json at
// the zip root as the Chrome Web Store asks. Files are sorted and carry one fixed date, so
// the same build gives the same zip bytes. Run after `npm run build`: npm run zip.
import { zipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtFiles } from './check-dist.mjs';

/** The date stored for every file in the zip (the zip format starts at 1980). */
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

export const zipName = (version) => `webaiassist-${version}.zip`;

/** The zip bytes of `files` (path -> bytes). */
export function makeZip(files) {
  const sorted = Object.keys(files).sort();
  return zipSync(Object.fromEntries(sorted.map((path) => [path, files[path]])), {
    level: 9,
    mtime: FIXED_DATE,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dist = join(root, 'dist');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const files = Object.fromEntries(
    builtFiles(dist).map((path) => [path, readFileSync(join(dist, path))]),
  );
  const zip = makeZip(files);
  writeFileSync(join(root, zipName(version)), zip);
  console.log(
    `${zipName(version)} written: ${Object.keys(files).length} files, ${zip.length} bytes`,
  );
}
