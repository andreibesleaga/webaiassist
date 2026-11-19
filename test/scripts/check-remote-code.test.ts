// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkModelLibFiles, checkRemoteCode } from '../../scripts/check-remote-code.mjs';
import pins from '../../scripts/model-libs.json';

describe('checkRemoteCode', () => {
  it('passes bundles that name only data hosts', () => {
    const texts = { 'a.js': 'fetch("https://huggingface.co/unsloth/x/resolve/abc/model.gguf")' };
    expect(checkRemoteCode(texts)).toEqual([]);
  });

  it('refuses a bundle that names raw.githubusercontent.com', () => {
    const texts = {
      'chunk.js': 'const p = "https://raw.githubusercontent.com/someone/some-libs/main/lib/";',
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

const bytes = Buffer.from('not the real library');

describe('checkModelLibFiles', () => {
  const realHash = createHash('sha256').update(bytes).digest('hex');
  const fakePins = {
    runtimes: pins.runtimes.map((r) => ({ ...r, bytes: bytes.length, sha256: realHash })),
  };
  const allFiles = fakePins.runtimes.map((r) => `model-libs/${r.file}`);
  const read = (): Buffer => bytes;

  it('passes when every pinned engine file is present with its SHA-256 and nothing else is wasm', () => {
    expect(checkModelLibFiles(allFiles, read, fakePins)).toEqual([]);
  });

  it('refuses a missing engine file, a changed one and an extra .wasm file', () => {
    const missing = checkModelLibFiles(allFiles.slice(1), read, fakePins);
    expect(missing.join('\n')).toMatch(/missing/);
    const changed = checkModelLibFiles(
      allFiles,
      () => Buffer.from('changed bytes!!!!!!!!'),
      fakePins,
    );
    expect(changed.join('\n')).toMatch(/bytes|SHA-256/);
    const extra = checkModelLibFiles([...allFiles, 'chunks/other.wasm'], read, fakePins);
    expect(extra.join('\n')).toMatch(/chunks\/other\.wasm is not a pinned engine file/);
  });

  it('refuses an extra .wasm file even inside model-libs/', () => {
    const extra = checkModelLibFiles([...allFiles, 'model-libs/extra.wasm'], read, fakePins);
    expect(extra.join('\n')).toMatch(/model-libs\/extra\.wasm is not a pinned engine file/);
  });

  it('holds the wllama engine to its pin: present, and byte for byte', () => {
    const wllama = 'model-libs/wllama.wasm';
    expect(allFiles).toContain(wllama);
    const withoutIt = allFiles.filter((f) => f !== wllama);
    expect(checkModelLibFiles(withoutIt, read, fakePins).join('\n')).toMatch(
      /wllama\.wasm is missing/,
    );
    const changed = checkModelLibFiles(
      allFiles,
      (p) => (p.endsWith('wllama.wasm') ? Buffer.from('x') : bytes),
      fakePins,
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
    const problems = checkModelLibFiles([], read).join('\n');
    for (const r of pins.runtimes) expect(problems).toContain(r.file);
  });
});
