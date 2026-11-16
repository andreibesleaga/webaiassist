// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026: checks on the built package (dist/ and the
// zip), the model-library pins and store-review points. Run after `npm run build` and
// `npm run zip` (`npm run test:dist` in the release gate, where a missing build fails); skipped
// when dist/ is missing in a plain `vitest run`. A failing test is an open finding.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { bundledAppConfig } from '../../src/adapters/webllm-app-config';
import pins from '../../scripts/model-libs.json';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ZIP = join(ROOT, 'webaiassist-0.1.0.zip');
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

  it('the only WebAssembly files are the pinned model libraries and runtime engines', () => {
    const wasm = files(DIST).filter((p) => p.endsWith('.wasm'));
    const pinned = [...pins.libs, ...pins.runtimes];
    expect(wasm.sort()).toEqual(pinned.map((lib) => `model-libs/${lib.file}`).sort());
    for (const lib of pinned) {
      expect(sha256(readFileSync(join(DIST, 'model-libs', lib.file)))).toBe(lib.sha256);
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

  it('weights come from one fixed Hugging Face revision per shipped model', () => {
    const config = bundledAppConfig((p) => `chrome-extension://x/${p}`);
    for (const record of config.model_list) {
      expect(record.model).toMatch(
        /^https:\/\/huggingface\.co\/mlc-ai\/[^/]+\/resolve\/[0-9a-f]{40}\/$/,
      );
      expect(record.model_lib.startsWith('chrome-extension://x/model-libs/')).toBe(true);
      expect(record.integrity.onFailure).toBe('error');
    }
  });
});

describe('finding: WebLLM can hash-check the model config and tokenizer, but is not asked to', () => {
  it('every shipped model pins its mlc-chat-config.json and tokenizer.json', () => {
    for (const record of bundledAppConfig((p) => p).model_list) {
      const integrity: Record<string, unknown> = { ...record.integrity };
      const config = typeof integrity.config === 'string' ? integrity.config : '';
      expect(config, record.model_id).toMatch(/^sha256-/);
      expect(integrity.tokenizer, record.model_id).toBeTypeOf('object');
    }
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
