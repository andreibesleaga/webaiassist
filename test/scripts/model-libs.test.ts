// SPDX-License-Identifier: Apache-2.0
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pinnedWasmPaths, RUNTIMES, wllamaNoRemote } from '../../scripts/model-libs.mjs';

const COMPAT_JS = 'https://cdn.jsdelivr.net/npm/@wllama/wllama-compat@3.8.1/wasm/wllama.js';
const COMPAT_WASM = 'https://cdn.jsdelivr.net/npm/@wllama/wllama-compat@3.8.1/wasm/wllama.wasm';

/** Runs the plugin's onLoad on a file with `source` at the path wllama's bundle has. */
function load(source: string): { contents: string } {
  const dir = join(mkdtempSync(join(tmpdir(), 'wllama-')), 'node_modules/@wllama/wllama/esm');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'index.js');
  writeFileSync(path, source);
  let result = { contents: '' };
  wllamaNoRemote.setup({
    onLoad: (options, callback) => {
      expect(options.filter.test(path)).toBe(true);
      result = callback({ path });
    },
  });
  return result;
}

describe('wllamaNoRemote', () => {
  it('replaces the two remote compatibility addresses and the address in a comment', () => {
    const out = load(
      `a = "${COMPAT_JS}"; b = "${COMPAT_WASM}"; // at http://localhost:8080/esm/wasm/wllama.wasm:wasm-function[1]`,
    );
    expect(out.contents).not.toMatch(/jsdelivr|localhost:8080/);
    expect(out.contents).toContain('webaiassist-bundled-libraries-only:/');
  });

  it('fails the build when the package no longer has exactly the two addresses', () => {
    expect(() => load(`a = "${COMPAT_JS}";`)).toThrow(
      /expected wllama's two remote addresses, found 1/,
    );
    expect(() => load('nothing here')).toThrow(/found 0/);
  });

  it('does not touch other files', () => {
    const filter = /@wllama[\\/]wllama[\\/]esm[\\/]index\.js$/;
    expect(filter.test('/x/node_modules/@wllama/wllama/esm/glue/index.js')).toBe(false);
  });
});

describe('pinned wasm files', () => {
  it('lists the four model libraries and the wllama engine under model-libs/', () => {
    expect(pinnedWasmPaths().sort()).toEqual([
      'model-libs/Llama-3.2-3B-Instruct-q4f16_1_cs1k-webgpu.wasm',
      'model-libs/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm',
      'model-libs/Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm',
      'model-libs/gemma-4-E2B-it-q4f16_1_cs512-webgpu.wasm',
      'model-libs/wllama.wasm',
    ]);
    expect(RUNTIMES.map((r) => r.file)).toEqual(['wllama.wasm']);
  });
});
