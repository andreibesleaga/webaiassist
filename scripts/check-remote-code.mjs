// SPDX-License-Identifier: Apache-2.0
// The Chrome Web Store forbids remotely hosted code in Manifest V3, and counts WebAssembly
// as code. Two checks of a build: no bundle names a place that code could be fetched from,
// and the only .wasm files are the pinned engine files, byte for byte.
import { libProblems, LIBS_FOLDER, MODEL_LIBS, pinnedWasmPaths } from './model-libs.mjs';

const REMOTE_CODE_RULES = [
  [
    /raw\.githubusercontent\.com/,
    'names raw.githubusercontent.com, a host code could be fetched from',
  ],
  [/https?:\/\/[^"'`\s]+\.wasm\b/, 'names a remote WebAssembly file'],
  [/import\(\s*["'`]https?:/, 'imports a remote module'],
  [/importScripts\(\s*["'`]https?:/, 'loads a remote worker script'],
];

/** Problems in the built .js and .html files, given as path -> text. */
export function checkRemoteCode(texts) {
  const problems = [];
  for (const [path, text] of Object.entries(texts)) {
    for (const [pattern, what] of REMOTE_CODE_RULES) {
      if (pattern.test(text)) problems.push(`${path} ${what}`);
    }
  }
  return problems;
}

/** Problems with the .wasm files of a build; `files` are paths relative to the build folder. */
export function checkModelLibFiles(files, read, pins = MODEL_LIBS) {
  const expected = pinnedWasmPaths(pins);
  const problems = files
    .filter((path) => path.endsWith('.wasm') && !expected.includes(path))
    .map((path) => `${path} is not a pinned engine file`);
  for (const lib of pins.runtimes) {
    const path = `${LIBS_FOLDER}/${lib.file}`;
    problems.push(...libProblems(lib, files.includes(path) ? Buffer.from(read(path)) : undefined));
  }
  return problems;
}
