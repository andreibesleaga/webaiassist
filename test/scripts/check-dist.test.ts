// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkBundles,
  checkDevOnly,
  checkManifest,
  DEMO_HOSTS,
  EXPECTED_CSP,
  EXPECTED_OPTIONAL_HOSTS,
  EXPECTED_PERMISSIONS,
} from '../../scripts/check-dist.mjs';

const FILES = [
  'service-worker.js',
  'sidepanel.html',
  'offscreen.html',
  'options.html',
  'ui.css',
  'content-isolated.js',
  'content-main.js',
  'model-worker.js',
  'webmcp-polyfill.js',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
];
const ICONS = {
  '16': 'icons/icon-16.png',
  '32': 'icons/icon-32.png',
  '48': 'icons/icon-48.png',
  '128': 'icons/icon-128.png',
};
const exists = (path: string): boolean => FILES.includes(path);

const good = {
  manifest_version: 3,
  name: 'WebAIAssist',
  version: '0.0.1',
  description: 'A local AI model in your side panel.',
  permissions: [...EXPECTED_PERMISSIONS],
  optional_host_permissions: [...EXPECTED_OPTIONAL_HOSTS],
  background: { service_worker: 'service-worker.js', type: 'module' },
  side_panel: { default_path: 'sidepanel.html' },
  options_page: 'options.html',
  content_security_policy: { extension_pages: EXPECTED_CSP },
  icons: ICONS,
};

describe('checkManifest', () => {
  it('expects exactly the five install permissions', () => {
    expect([...EXPECTED_PERMISSIONS].sort()).toEqual([
      'activeTab',
      'offscreen',
      'scripting',
      'sidePanel',
      'storage',
    ]);
  });

  it('allows per-site host access only as optional, never <all_urls>', () => {
    expect([...EXPECTED_OPTIONAL_HOSTS]).toEqual([
      'https://*/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
    expect(EXPECTED_CSP).toBe("script-src 'self' 'wasm-unsafe-eval'; object-src 'self';");
  });

  it('passes a minimal valid manifest', () => {
    expect(checkManifest(good, exists)).toEqual([]);
  });

  it('requires Manifest V3, the name and a numeric version', () => {
    const problems = checkManifest(
      { ...good, manifest_version: 2, name: 'X', version: '1.x' },
      exists,
    );
    expect(problems).toEqual([
      'manifest_version must be 3',
      'name must be "WebAIAssist"',
      'version must be one to four dot-separated numbers',
    ]);
  });

  it('refuses extra or missing permissions', () => {
    const problems = checkManifest({ ...good, permissions: ['tabs', 'storage'] }, exists);
    expect(problems).toEqual([
      'permissions must be exactly activeTab, offscreen, scripting, sidePanel, storage',
    ]);
  });

  it('refuses install-time host access, other optional hosts and content scripts', () => {
    const problems = checkManifest(
      {
        ...good,
        host_permissions: ['<all_urls>'],
        optional_host_permissions: ['<all_urls>'],
        content_scripts: [{ matches: ['*://*/*'], js: ['a.js'] }],
      },
      exists,
    );
    expect(problems).toEqual([
      'host_permissions must be empty',
      'optional_host_permissions must be exactly https://*/*, http://localhost/*, http://127.0.0.1/*',
      'content_scripts must not be declared',
    ]);
  });

  it('requires the 128-pixel icon the Chrome Web Store asks for, and every icon file', () => {
    const { icons: _icons, ...noIcons } = good;
    expect(checkManifest(noIcons, exists)).toEqual(['icons must name a 128-pixel PNG']);
    const missing = { ...good, icons: { ...ICONS, '128': 'icons/gone.png' } };
    expect(checkManifest(missing, exists)).toEqual(['missing file: icons/gone.png']);
  });

  it('refuses ways for web pages or other extensions to reach the extension', () => {
    const problems = checkManifest(
      {
        ...good,
        web_accessible_resources: [{ resources: ['sidepanel.html'], matches: ['<all_urls>'] }],
        externally_connectable: { matches: ['https://*/*'] },
      },
      exists,
    );
    expect(problems).toEqual([
      'web_accessible_resources must not be declared',
      'externally_connectable must not be declared',
    ]);
  });

  it('allows 127.0.0.1 and 127.0.0.2 at install only in the smoke-test build', () => {
    const smoke = { ...good, host_permissions: ['http://127.0.0.1/*', 'http://127.0.0.2/*'] };
    const devExists = (path: string): boolean => exists(path) || path.startsWith('spike/');
    expect(checkManifest(smoke, devExists, 'smoke')).toEqual([]);
    expect(checkManifest(smoke, exists)).toEqual(['host_permissions must be empty']);
    expect(checkManifest(good, devExists, 'smoke')).toEqual([
      'host_permissions must be exactly http://127.0.0.1/*, http://127.0.0.2/*',
    ]);
  });

  it('requires exactly the WebAssembly CSP, and a short description', () => {
    const problems = checkManifest(
      {
        ...good,
        description: 'd'.repeat(133),
        content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'" },
      },
      exists,
    );
    expect(problems).toEqual([
      'description must be at most 132 characters',
      `extension_pages CSP must be exactly ${EXPECTED_CSP}`,
    ]);
    expect(checkManifest({ ...good, content_security_policy: undefined }, exists)).toEqual([
      `extension_pages CSP must be exactly ${EXPECTED_CSP}`,
    ]);
  });

  it('requires a module service worker and refuses references to files that were not built', () => {
    const problems = checkManifest(
      { ...good, background: { service_worker: 'service-worker.js' } },
      (path) => path !== 'model-worker.js' && path !== 'options.html',
    );
    expect(problems).toEqual([
      'background must be a module service worker',
      'missing file: options.html',
      'missing file: model-worker.js',
    ]);
  });

  it('requires the spike page in the development build only', () => {
    expect(checkManifest(good, exists, 'release')).toEqual([]);
    const smoke = { ...good, host_permissions: ['http://127.0.0.1/*', 'http://127.0.0.2/*'] };
    expect(checkManifest(smoke, exists, 'smoke')).toEqual([
      'missing file: spike/index.html',
      'missing file: spike/spike.js',
    ]);
  });
});

describe('checkDevOnly', () => {
  it('passes a release build with nothing of the development build', () => {
    const texts = { 'sidepanel.html': '<p>help</p>', 'sidepanel.js': 'var fixedTab = 0;' };
    expect(checkDevOnly(['sidepanel.html', 'sidepanel.js'], texts)).toEqual([]);
  });

  it('refuses the spike page, a link to it and the ?tab= override', () => {
    const texts = {
      'sidepanel.html': '<p data-dev-only><a href="spike/index.html">check</a></p>',
      'sidepanel.js': 'Number(new URLSearchParams(location.search).get("tab"))',
    };
    expect(checkDevOnly(['spike/index.html', 'sidepanel.html'], texts)).toEqual([
      'spike/index.html is development-only (spike page)',
      'sidepanel.html links to the spike page',
      'sidepanel.js reads the ?tab= override',
    ]);
  });
});

describe('checkBundles', () => {
  it('passes plain bundles', () => {
    expect(checkBundles({ 'a.js': 'const x = 1;' }, 'release')).toEqual([]);
  });

  it('refuses code generation in any bundle', () => {
    expect(
      checkBundles({ 'a.js': 'new Function("x")', 'b.js': 'eval(s)', 'c.js': 'ok' }, 'release'),
    ).toEqual(['a.js uses new Function', 'b.js uses eval']);
  });

  it('refuses the scripted test model in the release build only', () => {
    const texts = { 'sidepanel.js': 'class ScriptedModelRuntime {}' };
    expect(checkBundles(texts, 'release')).toEqual([
      'sidepanel.js contains the scripted test model',
    ]);
    expect(checkBundles(texts, 'smoke')).toEqual([]);
  });

  it('refuses the fake processor engine and its test models in the release and eval builds', () => {
    const texts = { 'chunk.js': 'class FakeWllamaEngine {} const id = "smoke-cpu-bad-sum";' };
    expect(checkBundles(texts, 'release')).toEqual(['chunk.js contains the fake processor engine']);
    expect(checkBundles(texts, 'eval')).toEqual(['chunk.js contains the fake processor engine']);
    expect(checkBundles(texts, 'smoke')).toEqual([]);
  });

  it('allows the real processor engine in every build', () => {
    const texts = { 'chunk.js': 'class WllamaEngine {} // uses wllama.wasm' };
    expect(checkBundles(texts, 'release')).toEqual([]);
  });

  it('refuses a remote script source', () => {
    expect(
      checkBundles({ 'x.html': '<script src="https://cdn.example/x.js">' }, 'release'),
    ).toEqual(['x.html loads a remote script']);
  });
});

describe('the demo host (eval build made with --demos)', () => {
  const demo = { ...good, host_permissions: [...DEMO_HOSTS] };
  const devExists = (path: string): boolean => exists(path) || path.startsWith('spike/');

  it('is exactly the eval hosts plus googlechromelabs.github.io', () => {
    expect(DEMO_HOSTS).toEqual([
      'http://127.0.0.1/*',
      'http://localhost/*',
      'https://agenticsystemcore.com/*',
      'https://googlechromelabs.github.io/*',
    ]);
  });
  it('passes in the demos variant only', () => {
    expect(checkManifest(demo, devExists, 'demos')).toEqual([]);
    expect(checkManifest(demo, devExists, 'eval')).toEqual([
      'eval build host_permissions must be http://127.0.0.1/*, http://localhost/*, https://agenticsystemcore.com/*',
    ]);
  });
  it('is refused in the release build, which keeps zero install-time hosts', () => {
    expect(checkManifest(demo, exists, 'release')).toEqual(['host_permissions must be empty']);
    expect(
      checkManifest(
        { ...good, host_permissions: ['https://googlechromelabs.github.io/*'] },
        exists,
      ),
    ).toEqual(['host_permissions must be empty']);
  });
  it('is refused in the smoke build', () => {
    expect(checkManifest(demo, devExists, 'smoke')).toHaveLength(1);
  });
  it('is not in the source manifest, and build.mjs adds it only under --demos', () => {
    const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8')) as Record<
      string,
      unknown
    >;
    expect(manifest.host_permissions).toBeUndefined();
    const build = readFileSync('scripts/build.mjs', 'utf8');
    expect(build).toContain("const demos = process.argv.includes('--demos');");
    expect(build).toContain("...(demos ? ['https://googlechromelabs.github.io/*'] : [])");
    expect(build).toContain('const evalBuild = demos ||');
  });
});
