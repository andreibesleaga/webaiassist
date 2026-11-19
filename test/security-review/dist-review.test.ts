// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026: checks on the built package (dist/ and the
// zip), the engine-file pins and store-review points. Run after `npm run build` and
// `npm run zip` (`npm run test:dist` in the release gate, where a missing build fails); skipped
// when dist/ is missing in a plain `vitest run`. A failing test is an open finding.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { GPU_MODELS, LOCAL_FILES } from '../../src/adapters/cpu-models';
import pins from '../../scripts/model-libs.json';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const VERSION = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }
).version;
const ZIP = join(ROOT, `webaiassist-${VERSION}.zip`);
const built = existsSync(join(DIST, 'manifest.json')) && existsSync(ZIP);
/** Set by `npm run test:dist`, which the release gate runs after build and zip: then a missing
 *  build is a failure, not a skip, so a clean CI checkout cannot pass these checks unseen. */
const required = process.env.WEBAIASSIST_REQUIRE_DIST === '1';

describe.runIf(required)('the build these checks need', () => {
  it('dist/ and the zip are there', () => {
    expect(built).toBe(true);
  });
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [relative(DIST, path)];
  });
}

const read = (path: string): string => readFileSync(join(DIST, path), 'utf8');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const scripts = (): string[] => (built ? files(DIST).filter((p) => p.endsWith('.js')) : []);

describe.runIf(built)('held: the package', () => {
  it('the zip holds exactly the files of dist/, byte for byte', () => {
    const zipped = unzipSync(readFileSync(ZIP));
    const names = Object.keys(zipped).filter((name) => !name.endsWith('/'));
    expect(names.sort()).toEqual(files(DIST).sort());
    for (const name of names) {
      expect(sha256(zipped[name] ?? new Uint8Array()), name).toBe(
        sha256(readFileSync(join(DIST, name))),
      );
    }
    // It hashes every file of the package twice, about 0.8 s alone but slower on a busy machine
    // or under coverage, so it has its own time budget instead of the default 5 s.
  }, 30_000);

  it('the manifest opens nothing to web pages or other extensions', () => {
    const m = JSON.parse(read('manifest.json')) as Record<string, unknown>;
    expect(m.web_accessible_resources).toBeUndefined();
    expect(m.externally_connectable).toBeUndefined();
    expect(m.host_permissions).toBeUndefined();
    expect(m.content_scripts).toBeUndefined();
    expect(m.content_security_policy).toEqual({
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    });
  });

  it('the only WebAssembly files are the two pinned engine files, byte for byte', () => {
    const wasm = files(DIST).filter((p) => p.endsWith('.wasm'));
    const pinned = pins.runtimes;
    expect(pinned.map((lib) => lib.file).sort()).toEqual(['oxigraph.wasm', 'wllama.wasm']);
    expect(wasm.sort()).toEqual(pinned.map((lib) => `model-libs/${lib.file}`).sort());
    for (const lib of pinned) {
      const bytes = readFileSync(join(DIST, 'model-libs', lib.file));
      expect(bytes.length, lib.file).toBe(lib.bytes);
      expect(sha256(bytes), lib.file).toBe(lib.sha256);
    }
  });

  it('no bundle registers external listeners, injects into all frames or loads remote code', () => {
    for (const path of scripts()) {
      const text = read(path);
      expect(text, path).not.toMatch(
        /onMessageExternal|onConnectExternal|allFrames\s*:\s*(!0|true)/,
      );
      expect(text, path).not.toMatch(/importScripts\(\s*["'`]https?:|import\(\s*["'`]https?:/);
      expect(text, path).not.toMatch(/raw\.githubusercontent\.com/);
      // A .wasm path inside the package is fine: model-libs/..., and the file name wllama's
      // Emscripten code asks its own path table for (locateFile). Any other call with a .wasm
      // name is not.
      const withoutPackaged = text.replace(/locateFile\(["']wllama\.wasm["']\)/g, '');
      expect(withoutPackaged, path).not.toMatch(/(?<!model-libs\/[\w.-]{0,80})\.wasm["'`]\s*\)/);
    }
  });

  it('weights come from one fixed Hugging Face revision per shipped model file', () => {
    for (const model of LOCAL_FILES) {
      expect(model.url, model.id).toMatch(
        /^https:\/\/huggingface\.co\/[\w.-]+\/[\w.-]+\/resolve\/[0-9a-f]{40}\/[\w.-]+\.gguf$/,
      );
    }
  });
});

describe('every graphics-card and processor model pins its file', () => {
  it('has a size and a SHA-256, and no weights in the package', () => {
    for (const model of [...LOCAL_FILES, ...GPU_MODELS]) {
      expect(model.sha256, model.id).toMatch(/^[0-9a-f]{64}$/);
      expect(model.bytes, model.id).toBeGreaterThan(0);
    }
    if (built) expect(files(DIST).filter((p) => p.endsWith('.gguf'))).toEqual([]);
  });
});

describe.runIf(built)('finding: the offscreen reason does not match what the document does', () => {
  it('a document opened for WORKERS starts a Worker', () => {
    const worker = read('service-worker.js');
    const offscreenGraph = ['offscreen.js', ...files(DIST).filter((p) => p.startsWith('chunks/'))];
    expect(worker).toContain('WORKERS');
    expect(offscreenGraph.some((path) => /new Worker\(/.test(read(path)))).toBe(true);
  });
});
