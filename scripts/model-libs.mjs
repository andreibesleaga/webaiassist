// SPDX-License-Identifier: Apache-2.0
// The engine files (.wasm) go inside the package, because the Chrome Web Store counts
// WebAssembly loaded from outside the package as remotely hosted code. Each one comes from an
// installed npm package under that package's own licence: the llama.cpp engine of
// @wllama/wllama, which runs every model in the browser, and the query engine. scripts/
// model-libs.json pins each file by size and SHA-256; a build checks the hash of every file and
// copies them into the extension. No model library is fetched from anywhere.
// wllama's two remote compatibility-build addresses are replaced (wllamaNoRemote).
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const MODEL_LIBS = JSON.parse(readFileSync(join(root, 'scripts/model-libs.json'), 'utf8'));
/** The folder inside the extension, read with chrome.runtime.getURL. */
export const LIBS_FOLDER = 'model-libs';

/** What the build puts in place of a remote code address: a URL that resolves nowhere. */
export const NO_REMOTE_PREFIX = 'webaiassist-bundled-libraries-only:/';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Problems with one library's bytes; empty when the size and SHA-256 match. */
export function libProblems(lib, bytes) {
  if (bytes === undefined) return [`${lib.file} is missing`];
  if (bytes.length !== lib.bytes)
    return [`${lib.file} has ${bytes.length} bytes, not ${lib.bytes}`];
  const hash = sha256(bytes);
  return hash === lib.sha256 ? [] : [`${lib.file} has SHA-256 ${hash}, not ${lib.sha256}`];
}

/** The runtime engines (.wasm) copied from an installed package: [{ file, from, bytes, sha256 }]. */
export const RUNTIMES = MODEL_LIBS.runtimes;

/** Every .wasm file a build holds, as paths inside the build folder. */
export function pinnedWasmPaths(pins = MODEL_LIBS) {
  return pins.runtimes.map((lib) => `${LIBS_FOLDER}/${lib.file}`);
}

function copyRuntimes(outDir) {
  for (const runtime of RUNTIMES) {
    const bytes = readFileSync(join(root, runtime.from));
    const problems = libProblems(runtime, bytes);
    if (problems.length > 0) throw new Error(`runtime check failed: ${problems.join('; ')}`);
    copyFileSync(join(root, runtime.from), join(outDir, LIBS_FOLDER, runtime.file));
  }
}

/** Checks every hash and copies the engine files to `<outDir>/model-libs/`. */
export function bundleModelLibs(outDir) {
  mkdirSync(join(outDir, LIBS_FOLDER), { recursive: true });
  copyRuntimes(outDir);
}

const WLLAMA_COMPAT_ADDRESS =
  /https:\/\/cdn\.jsdelivr\.net\/npm\/@wllama\/wllama-compat@[\w.-]+\/wasm\/wllama\.(js|wasm)/g;

/** A stack trace quoted in a comment of wllama's source names its test server's .wasm address. */
const WLLAMA_DOC_ADDRESS = /https?:\/\/localhost:8080\/esm\/wasm\//g;

/** esbuild plugin: replaces wllama's two remote compatibility-build addresses (used only after
 *  setCompat, which this extension never calls), exactly twice, and the address in a comment. */
export const wllamaNoRemote = {
  name: 'wllama-no-remote',
  setup(build) {
    build.onLoad({ filter: /@wllama[\\/]wllama[\\/]esm[\\/]index\.js$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      const count = (source.match(WLLAMA_COMPAT_ADDRESS) ?? []).length;
      if (count !== 2) throw new Error(`expected wllama's two remote addresses, found ${count}`);
      const contents = source
        .replace(WLLAMA_COMPAT_ADDRESS, NO_REMOTE_PREFIX)
        .replace(WLLAMA_DOC_ADDRESS, '');
      return { contents, loader: 'js' };
    });
  },
};
