// SPDX-License-Identifier: Apache-2.0
// The query engine files of agentic-system-core (third_party/agsc-query) are bundled into the
// query worker byte for byte. PINS.json holds the size and SHA-256 of each; the build stops on a
// difference and a test fails on it. The oxigraph engine itself (web.js and web_bg.wasm) is pinned
// too: the wasm in scripts/model-libs.json, web.js here.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const QUERY_DIR = join(root, 'third_party/agsc-query');
export const QUERY_PINS = JSON.parse(readFileSync(join(QUERY_DIR, 'PINS.json'), 'utf8'));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function readOrUndefined(path) {
  try {
    return readFileSync(path);
  } catch {
    return undefined;
  }
}

/** Problems with one file's bytes; empty when size and SHA-256 match the pin. */
export function pinProblems(pin, bytes) {
  if (bytes === undefined) return [`${pin.file} is missing`];
  if (bytes.length !== pin.bytes)
    return [`${pin.file} has ${bytes.length} bytes, not ${pin.bytes}`];
  const hash = sha256(bytes);
  return hash === pin.sha256 ? [] : [`${pin.file} has SHA-256 ${hash}, not ${pin.sha256}`];
}

/** Every problem of the pinned files on disk (the engine files, and oxigraph's web.js). */
export function queryProblems(pins = QUERY_PINS, base = root) {
  const own = pins.files.flatMap((pin) =>
    pinProblems(pin, readOrUndefined(join(QUERY_DIR, pin.file))),
  );
  const lib = pins.oxigraph;
  const webJs = { ...lib.webJs, file: `node_modules/${lib.package}/web.js` };
  return [
    ...own,
    ...pinProblems(webJs, readOrUndefined(join(base, 'node_modules/oxigraph/web.js'))),
  ];
}

/** Throws when a pinned file differs; the build calls it before it bundles the worker. */
export function checkQueryPins() {
  const problems = queryProblems();
  if (problems.length > 0)
    throw new Error(`query files differ from PINS.json:\n- ${problems.join('\n- ')}`);
}
