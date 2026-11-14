// SPDX-License-Identifier: Apache-2.0
// The model libraries (.wasm) of the four shipped models go inside the package, because the
// Chrome Web Store counts WebAssembly loaded from outside the package as remotely hosted
// code. scripts/model-libs.json pins each file to one commit of mlc-ai/binary-mlc-llm-libs
// and to its SHA-256. A build fetches a missing file once into vendor/model-libs/, checks
// the hash of every file on every build, and copies them into the extension.
// WebLLM's own default list points model libraries at raw.githubusercontent.com; the build
// replaces that one URL prefix (webLlmNoRemoteLibs), so no code path can fetch a library.
// The CPU runtime (@wllama/wllama) has one more .wasm file, the llama.cpp engine: it is
// pinned under "runtimes", copied from the installed package, and checked the same way.
// wllama's two remote compatibility-build addresses are replaced (wllamaNoRemote).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const MODEL_LIBS = JSON.parse(readFileSync(join(root, 'scripts/model-libs.json'), 'utf8'));
export const VENDOR_DIR = join(root, 'vendor/model-libs');
/** The folder inside the extension, read with chrome.runtime.getURL. */
export const LIBS_FOLDER = 'model-libs';

export const REMOTE_LIB_PREFIX =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/';
/** What the build puts in place of the remote prefix: a URL that resolves nowhere. */
export const NO_REMOTE_PREFIX = 'webaiassist-bundled-libraries-only:/';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The pinned download URL of one library. */
export function libUrl(lib) {
  const raw = MODEL_LIBS.source
    .replace('https://github.com/', 'https://raw.githubusercontent.com/')
    .replace('/tree/', '/');
  return `${raw}/${lib.file}`;
}

/** Problems with one library's bytes; empty when the size and SHA-256 match. */
export function libProblems(lib, bytes) {
  if (bytes === undefined) return [`${lib.file} is missing`];
  if (bytes.length !== lib.bytes)
    return [`${lib.file} has ${bytes.length} bytes, not ${lib.bytes}`];
  const hash = sha256(bytes);
  return hash === lib.sha256 ? [] : [`${lib.file} has SHA-256 ${hash}, not ${lib.sha256}`];
}

async function fetchOnce(lib, path) {
  const response = await fetch(libUrl(lib));
  if (!response.ok) throw new Error(`${libUrl(lib)}: HTTP ${response.status}`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  console.log(`fetched ${lib.file} once into vendor/model-libs/`);
}

/** The runtime engines (.wasm) copied from an installed package: [{ file, from, bytes, sha256 }]. */
export const RUNTIMES = MODEL_LIBS.runtimes ?? [];

/** Every .wasm file a build holds, as paths inside the build folder. */
export function pinnedWasmPaths(pins = MODEL_LIBS) {
  return [...pins.libs, ...(pins.runtimes ?? [])].map((lib) => `${LIBS_FOLDER}/${lib.file}`);
}

function copyRuntimes(outDir) {
  for (const runtime of RUNTIMES) {
    const bytes = readFileSync(join(root, runtime.from));
    const problems = libProblems(runtime, bytes);
    if (problems.length > 0) throw new Error(`runtime check failed: ${problems.join('; ')}`);
    copyFileSync(join(root, runtime.from), join(outDir, LIBS_FOLDER, runtime.file));
  }
}

/** Fetches missing libraries, checks every hash, and copies them to `<outDir>/model-libs/`. */
export async function bundleModelLibs(outDir) {
  mkdirSync(VENDOR_DIR, { recursive: true });
  mkdirSync(join(outDir, LIBS_FOLDER), { recursive: true });
  copyRuntimes(outDir);
  for (const lib of MODEL_LIBS.libs) {
    const cached = join(VENDOR_DIR, lib.file);
    if (!existsSync(cached)) await fetchOnce(lib, cached);
    const problems = libProblems(lib, readFileSync(cached));
    if (problems.length > 0) throw new Error(`model library check failed: ${problems.join('; ')}`);
    copyFileSync(cached, join(outDir, LIBS_FOLDER, lib.file));
  }
}

/** esbuild plugin: replaces WebLLM's remote model-library prefix, exactly once. */
export const webLlmNoRemoteLibs = {
  name: 'webllm-no-remote-libs',
  setup(build) {
    build.onLoad({ filter: /@mlc-ai[\\/]web-llm[\\/]lib[\\/]index\.js$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      const count = source.split(REMOTE_LIB_PREFIX).length - 1;
      if (count !== 1) {
        throw new Error(`expected WebLLM's remote library prefix once, found it ${count} times`);
      }
      return { contents: source.replace(REMOTE_LIB_PREFIX, NO_REMOTE_PREFIX), loader: 'js' };
    });
  },
};

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
