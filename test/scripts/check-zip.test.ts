// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { strToU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CSP,
  EXPECTED_OPTIONAL_HOSTS,
  EXPECTED_PERMISSIONS,
} from '../../scripts/check-dist.mjs';
import { checkZip, MAX_ZIP_BYTES } from '../../scripts/check-zip.mjs';
import { makeZip, zipName } from '../../scripts/zip.mjs';

const lib = Buffer.from('wasm bytes');
const pins = {
  runtimes: [
    { file: 'm.wasm', bytes: lib.length, sha256: createHash('sha256').update(lib).digest('hex') },
  ],
};

const manifest = {
  manifest_version: 3,
  name: 'WebAIAssist',
  version: '0.1.0',
  description: 'A local AI model in your side panel.',
  permissions: [...EXPECTED_PERMISSIONS],
  optional_host_permissions: [...EXPECTED_OPTIONAL_HOSTS],
  background: { service_worker: 'service-worker.js', type: 'module' },
  side_panel: { default_path: 'sidepanel.html' },
  options_page: 'options.html',
  content_security_policy: { extension_pages: EXPECTED_CSP },
  icons: { '128': 'icons/icon-128.png' },
};

function files(extra: Record<string, Uint8Array> = {}): Record<string, Uint8Array> {
  const named = [
    'service-worker.js',
    'sidepanel.html',
    'offscreen.html',
    'options.html',
    'ui.css',
    'content-isolated.js',
    'content-main.js',
    'query-worker.js',
    'query-worker.js',
    'webmcp-polyfill.js',
    'explorer.html',
    'explorer.css',
    'explorer.js',
    'explorer-vendor/assets/graph-data.js',
    'explorer-vendor/assets/graph-explorer.js',
    'explorer-vendor/assets/graph-explorer.css',
    'explorer-vendor/assets/vendor/force-graph-1.52.0.min.js',
    'icons/icon-128.png',
  ];
  return {
    'manifest.json': strToU8(JSON.stringify(manifest)),
    ...Object.fromEntries(named.map((name) => [name, strToU8('// plain\n')])),
    'model-libs/m.wasm': lib,
    ...extra,
  };
}

const check = (entries: Record<string, Uint8Array>, size = 1000) =>
  checkZip({ entries, size, version: '0.1.0', distFiles: Object.keys(files()), pins });

describe('zip of the release build', () => {
  it('is named after the version', () => {
    expect(zipName('0.1.0')).toBe('webaiassist-0.1.0.zip');
  });

  it('packs the files with manifest.json at the root, the same bytes on every run', () => {
    const zip = makeZip(files());
    expect(Object.keys(unzipSync(zip))).toContain('manifest.json');
    expect(Buffer.from(makeZip(files())).equals(Buffer.from(zip))).toBe(true);
  });
});

describe('checkZip', () => {
  it('passes the release files', () => {
    expect(check(files())).toEqual([]);
  });

  it('refuses source maps, sources, tests and files that are not in the build', () => {
    const problems = check(
      files({ 'a.js.map': strToU8('{}'), 'src/x.ts': strToU8(''), 'test/t.js': strToU8('') }),
    ).join('\n');
    expect(problems).toMatch(/a\.js\.map is a source map/);
    expect(problems).toMatch(/src\/x\.ts is not in the build/);
    expect(problems).toMatch(/test\/t\.js is not in the build/);
  });

  it('refuses a source-map comment, the scripted test model and remote code in a bundle', () => {
    const bad = files({
      'service-worker.js': strToU8(
        'class ScriptedModelRuntime {}\nfetch("https://raw.githubusercontent.com/x/y.wasm")\n//# sourceMappingURL=sw.js.map',
      ),
    });
    const problems = check(bad).join('\n');
    expect(problems).toMatch(/scripted test model/);
    expect(problems).toMatch(/raw\.githubusercontent\.com/);
    expect(problems).toMatch(/source-map comment/);
  });

  it('refuses a missing build file, a missing manifest and a wrong version', () => {
    const { 'ui.css': _gone, ...rest } = files();
    expect(check(rest).join('\n')).toMatch(/ui\.css is missing/);
    const { 'manifest.json': _none, ...noManifest } = files();
    expect(check(noManifest).join('\n')).toMatch(/manifest\.json is not at the root/);
    const old = files({
      'manifest.json': strToU8(JSON.stringify({ ...manifest, version: '0.0.9' })),
    });
    expect(check(old).join('\n')).toMatch(/version 0\.0\.9, not 0\.1\.0/);
  });

  it('refuses extra permissions in the packed manifest', () => {
    const wide = { ...manifest, permissions: [...EXPECTED_PERMISSIONS, 'tabs'] };
    expect(check(files({ 'manifest.json': strToU8(JSON.stringify(wide)) })).join('\n')).toMatch(
      /permissions must be exactly/,
    );
  });

  it('refuses a zip above the size limit', () => {
    expect(check(files(), MAX_ZIP_BYTES + 1).join('\n')).toMatch(/bytes; the limit is/);
  });
});
