// SPDX-License-Identifier: Apache-2.0
// Checks a build after `npm run build` (dist/) or `npm run build:smoke` (dist-smoke/):
// Manifest V3, exactly the documented permissions, host access only as optional per-site
// grants, the WebAssembly CSP and nothing looser, every named file present, and bundles
// with no code generation, no remote script and (release only) no scripted test model,
// no remotely hosted code, and the pinned model libraries byte for byte
// (scripts/check-remote-code.mjs). The release build must also hold nothing of the
// development build: no spike page, no browser-check link, no ?tab= override.
// Exits 1 and lists the problems when a check fails.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkModelLibFiles, checkRemoteCode } from './check-remote-code.mjs';

/** The install permissions, each explained in README.md. */
export const EXPECTED_PERMISSIONS = Object.freeze([
  'activeTab',
  'offscreen',
  'scripting',
  'sidePanel',
  'storage',
]);

/** Per-site access the user may grant at runtime (compat mode, endpoint); none at install. */
export const EXPECTED_OPTIONAL_HOSTS = Object.freeze([
  'https://*/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
]);

/** The Manifest V3 minimum plus WebAssembly, which WebLLM needs. */
export const EXPECTED_CSP = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';";

/** Install-time host access of the smoke-test build only (its local test pages: two sites). */
const SMOKE_HOSTS = ['http://127.0.0.1/*', 'http://127.0.0.2/*'];
/** Install-time host access of the eval build only (scripts/eval/run.ts targets). */
const EVAL_HOSTS = ['http://127.0.0.1/*', 'http://localhost/*', 'https://agenticsystemcore.com/*'];

/** Files the extension loads by path, besides those the manifest names. */
const EXTRA_FILES = [
  'offscreen.html',
  'ui.css',
  'content-isolated.js',
  'content-main.js',
  'model-worker.js',
  'webmcp-polyfill.js',
];

/** Files of the development build (dist-smoke/) only. */
const DEV_FILES = ['spike/index.html', 'spike/spike.js'];

const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...b].sort());

function checkIdentity(m) {
  const problems = [];
  if (m.manifest_version !== 3) problems.push('manifest_version must be 3');
  if (m.name !== 'WebAIAssist') problems.push('name must be "WebAIAssist"');
  if (!/^\d+(\.\d+){0,3}$/.test(String(m.version))) {
    problems.push('version must be one to four dot-separated numbers');
  }
  if (String(m.description ?? '').length > 132)
    problems.push('description must be at most 132 characters');
  if (typeof m.icons?.['128'] !== 'string') problems.push('icons must name a 128-pixel PNG');
  return problems;
}

function checkHosts(m, variant) {
  const problems = [];
  if (variant === 'eval' && !same(m.host_permissions, EVAL_HOSTS)) {
    problems.push(`eval build host_permissions must be ${EVAL_HOSTS.join(', ')}`);
  }
  if (variant === 'smoke' && !same(m.host_permissions, SMOKE_HOSTS)) {
    problems.push(`host_permissions must be exactly ${SMOKE_HOSTS.join(', ')}`);
  }
  if (variant === 'release' && (m.host_permissions ?? []).length > 0) {
    problems.push('host_permissions must be empty');
  }
  if (!same(m.optional_host_permissions, EXPECTED_OPTIONAL_HOSTS)) {
    problems.push(
      `optional_host_permissions must be exactly ${EXPECTED_OPTIONAL_HOSTS.join(', ')}`,
    );
  }
  return problems;
}

function checkAccess(m, variant) {
  const problems = [];
  if (!same(m.permissions, EXPECTED_PERMISSIONS)) {
    problems.push(`permissions must be exactly ${[...EXPECTED_PERMISSIONS].sort().join(', ')}`);
  }
  problems.push(...checkHosts(m, variant));
  if (m.content_scripts !== undefined) problems.push('content_scripts must not be declared');
  // Pages could frame or open the panel, and other extensions or sites could message it.
  for (const key of ['web_accessible_resources', 'externally_connectable']) {
    if (m[key] !== undefined) problems.push(`${key} must not be declared`);
  }
  if (m.content_security_policy?.extension_pages !== EXPECTED_CSP) {
    problems.push(`extension_pages CSP must be exactly ${EXPECTED_CSP}`);
  }
  if (m.background?.type !== 'module') problems.push('background must be a module service worker');
  // The one key the owner approved: the keyboard shortcut of the toolbar button.
  if (m.commands !== undefined && !same(Object.keys(m.commands), ['_execute_action'])) {
    problems.push('commands may only declare _execute_action');
  }
  return problems;
}

function checkFiles(m, exists, variant) {
  const named = [
    m.background?.service_worker,
    m.side_panel?.default_path,
    m.options_page,
    ...Object.values(m.icons ?? {}),
    ...Object.values(m.action?.default_icon ?? {}),
    ...EXTRA_FILES,
    ...(variant !== 'release' ? DEV_FILES : []),
  ];
  return named.filter((path) => !path || !exists(path)).map((path) => `missing file: ${path}`);
}

/** All problems found; an empty list means the manifest is fine. */
export function checkManifest(manifest, exists, variant = 'release') {
  return [
    ...checkIdentity(manifest),
    ...checkAccess(manifest, variant),
    ...checkFiles(manifest, exists, variant),
  ];
}

/** Development-only content in a release build: spike files, its link, the ?tab= override. */
export function checkDevOnly(paths, texts) {
  const problems = paths
    .filter((path) => path.startsWith('spike/'))
    .map((path) => `${path} is development-only (spike page)`);
  for (const [path, text] of Object.entries(texts)) {
    if (/data-dev-only|href="spike\//.test(text)) problems.push(`${path} links to the spike page`);
    if (/\.get\(\s*["'`]tab["'`]\s*\)/.test(text)) {
      problems.push(`${path} reads the ?tab= override`);
    }
  }
  return problems;
}

const BUNDLE_RULES = [
  [/new Function\s*\(/, 'uses new Function'],
  [/(^|[^\w.$])eval\s*\(/, 'uses eval'],
  [/<script[^>]+src=["']https?:/i, 'loads a remote script'],
];

/** Problems in the built .js and .html files, given as path -> text. */
export function checkBundles(texts, variant) {
  const problems = [];
  for (const [path, text] of Object.entries(texts)) {
    for (const [pattern, what] of BUNDLE_RULES) {
      if (pattern.test(text)) problems.push(`${path} ${what}`);
    }
    if (variant === 'release' && text.includes('ScriptedModelRuntime')) {
      problems.push(`${path} contains the scripted test model`);
    }
    if (variant !== 'smoke' && /FakeWllamaEngine|smoke-cpu/.test(text)) {
      problems.push(`${path} contains the fake processor engine`);
    }
  }
  return problems;
}

/** Every file of a build, as paths relative to its folder with "/" separators. */
export function builtFiles(dir) {
  const files = [];
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(relative(dir, path).split(sep).join('/'));
    }
  };
  walk(dir);
  return files.sort();
}

function builtTexts(dir) {
  const texts = {};
  for (const path of builtFiles(dir).filter((file) => /\.(js|html)$/.test(file))) {
    texts[path] = readFileSync(join(dir, path), 'utf8');
  }
  return texts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const variant = process.argv.includes('--eval')
    ? 'eval'
    : process.argv.includes('--smoke')
      ? 'smoke'
      : 'release';
  const folder = variant === 'eval' ? 'dist-eval' : variant === 'smoke' ? 'dist-smoke' : 'dist';
  const dist = fileURLToPath(new URL(`../${folder}/`, import.meta.url));
  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
  const problems = [
    ...checkManifest(manifest, (path) => existsSync(join(dist, path)), variant),
    ...checkBundles(builtTexts(dist), variant),
    ...checkRemoteCode(builtTexts(dist)),
    ...checkModelLibFiles(builtFiles(dist), (path) => readFileSync(join(dist, path))),
    ...(variant === 'release' ? checkDevOnly(builtFiles(dist), builtTexts(dist)) : []),
  ];
  if (problems.length > 0) {
    console.error(`${folder}: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(
    `${folder}/manifest.json: OK (Manifest V3, permissions: ${manifest.permissions.join(', ')})`,
  );
}
