// SPDX-License-Identifier: Apache-2.0
// The site's graph explorer (third_party/agsc-explorer) and force-graph are shipped as files, byte for
// byte. PINS.json holds the size and SHA-256 of each; this module checks them (the build stops on a
// difference, a test fails on it) and copies them into the extension, in the folder layout of the
// site (explorer-vendor/assets/...), which the site's explorer code expects.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const PINS_DIR = join(root, 'third_party/agsc-explorer');
export const PINS = JSON.parse(readFileSync(join(PINS_DIR, 'PINS.json'), 'utf8'));
/** The folder inside the extension, below which the site's layout is kept. */
export const EXPLORER_FOLDER = 'explorer-vendor';
const FORCE_GRAPH_FILE = 'assets/vendor/force-graph-1.52.0.min.js';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The pinned files: where each is read from, and where it goes inside the extension. */
export function explorerFiles(pins = PINS, base = root) {
  const own = pins.files
    .filter((file) => file.file !== 'explorer-markup.html')
    .map((file) => ({
      ...file,
      from: join(PINS_DIR, file.file),
      to: `${EXPLORER_FOLDER}/assets/${file.file}`,
    }));
  const lib = {
    ...pins.forceGraph,
    from: join(base, 'node_modules/force-graph/dist/force-graph.min.js'),
    to: `${EXPLORER_FOLDER}/${FORCE_GRAPH_FILE}`,
  };
  return [...own, lib];
}

/** Problems with one file's bytes; empty when size and SHA-256 match the pin. */
export function pinProblems(pin, bytes) {
  if (bytes === undefined) return [`${pin.from} is missing`];
  if (bytes.length !== pin.bytes)
    return [`${pin.from} has ${bytes.length} bytes, not ${pin.bytes}`];
  const hash = sha256(bytes);
  return hash === pin.sha256 ? [] : [`${pin.from} has SHA-256 ${hash}, not ${pin.sha256}`];
}

function readOrUndefined(path) {
  try {
    return readFileSync(path);
  } catch {
    return undefined;
  }
}

/** Every problem of the pinned files on disk. */
export function explorerProblems(pins = PINS, base = root) {
  return explorerFiles(pins, base).flatMap((pin) => pinProblems(pin, readOrUndefined(pin.from)));
}

/** Checks the pins, then copies the files into `outDir`. Throws when a file differs from its pin. */
export function copyExplorer(outDir) {
  const problems = explorerProblems();
  if (problems.length > 0)
    throw new Error(`explorer files differ from PINS.json:\n- ${problems.join('\n- ')}`);
  for (const pin of explorerFiles()) {
    const to = join(outDir, pin.to);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(pin.from, to);
  }
}
