// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkModelLibFiles, checkRemoteCode } from '../../scripts/check-remote-code.mjs';
import pins from '../../scripts/model-libs.json';

describe('checkRemoteCode', () => {
  it('passes bundles that name only data hosts', () => {
    const texts = { 'a.js': 'fetch("https://huggingface.co/mlc-ai/x/resolve/abc/params.bin")' };
    expect(checkRemoteCode(texts)).toEqual([]);
  });

  it("refuses WebLLM's remote model-library host", () => {
    const texts = {
      'chunk.js':
        'const p = "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/";',
    };
    expect(checkRemoteCode(texts).join('\n')).toMatch(/chunk\.js .*raw\.githubusercontent\.com/);
  });

  it('refuses any remote .wasm URL and a remote dynamic import or importScripts', () => {
    expect(checkRemoteCode({ 'a.js': 'x("https://cdn.example/lib.wasm")' })).toHaveLength(1);
    expect(checkRemoteCode({ 'b.js': 'await import("https://cdn.example/m.js")' })).toHaveLength(1);
    expect(checkRemoteCode({ 'c.js': "importScripts('https://cdn.example/w.js')" })).toHaveLength(
      1,
    );
  });
});

const lib = pins.libs[0];
const bytes = Buffer.from('not the real library');

describe('checkModelLibFiles', () => {
  const realHash = createHash('sha256').update(bytes).digest('hex');
  const fakePins = {
    libs: pins.libs.map((l) => ({ ...l, bytes: bytes.length, sha256: realHash })),
  };
  const allFiles = fakePins.libs.map((l) => `model-libs/${l.file}`);
  const read = (): Buffer => bytes;

  it('passes when every pinned library is present with its SHA-256 and nothing else is wasm', () => {
    expect(checkModelLibFiles(allFiles, read, fakePins)).toEqual([]);
  });

  it('refuses a missing library, a changed one and an extra .wasm file', () => {
    const missing = checkModelLibFiles(allFiles.slice(1), read, fakePins);
    expect(missing.join('\n')).toMatch(/missing/);
    const changed = checkModelLibFiles(
      allFiles,
      () => Buffer.from('changed bytes!!!!!!!!'),
      fakePins,
    );
    expect(changed.join('\n')).toMatch(/bytes|SHA-256/);
    const extra = checkModelLibFiles([...allFiles, 'chunks/other.wasm'], read, fakePins);
    expect(extra.join('\n')).toMatch(/chunks\/other\.wasm is not a pinned model library/);
  });

  it('also holds the runtime engine to its pin: present, byte for byte, and the only extra .wasm', () => {
    const withRuntime = {
      ...fakePins,
      runtimes: [{ file: 'wllama.wasm', bytes: bytes.length, sha256: realHash }],
    };
    const files = [...allFiles, 'model-libs/wllama.wasm'];
    expect(checkModelLibFiles(files, read, withRuntime)).toEqual([]);
    expect(checkModelLibFiles(allFiles, read, withRuntime).join('\n')).toMatch(
      /wllama\.wasm is missing/,
    );
    const changed = checkModelLibFiles(
      files,
      (p) => (p.endsWith('wllama.wasm') ? Buffer.from('x') : bytes),
      withRuntime,
    );
    expect(changed.join('\n')).toMatch(/wllama\.wasm has/);
  });

  it('pins the real wllama engine at the version in package.json', () => {
    const [engine] = pins.runtimes;
    expect(engine).toMatchObject({
      package: '@wllama/wllama@3.8.1',
      file: 'wllama.wasm',
      bytes: 8763949,
      sha256: '551f13439366eff11e057b1b91fe46a7fdac29d56d67372d4c5f19a549dfe70c',
    });
  });

  it('uses the real pins by default', () => {
    expect(checkModelLibFiles([], read).join('\n')).toContain(lib?.file ?? '-');
  });
});
