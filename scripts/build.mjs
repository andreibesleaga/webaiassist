// SPDX-License-Identifier: Apache-2.0
// The one build config. Two esbuild passes:
// 1. Extension pages and the service worker as ES modules with shared chunks, so WebLLM
//    is bundled once (the service worker is declared "type": "module").
//    The model Worker (model-worker.js) the offscreen document starts is one of them.
// 2. Scripts that go into web pages as classic scripts: the two page-bridge scripts, the
//    WebMCP polyfill for compat mode, and (development build only) the spike page.
// The four model libraries (.wasm) and the CPU runtime engine (wllama.wasm) are copied in from
// the pinned, hash-checked files (scripts/model-libs.mjs); WebLLM's remote library URL and
// wllama's two remote compatibility addresses are replaced, so nothing fetches code.
// `--smoke` writes dist-smoke/, the development build: the scripted test model, access to
// http://127.0.0.1 and http://127.0.0.2 and the ?tab= override for the Playwright smoke test, and the browser
// check (spike) page. The release build, dist/, has none of these (scripts/check-dist.mjs).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { bundleModelLibs, webLlmNoRemoteLibs, wllamaNoRemote } from './model-libs.mjs';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

// `--eval` writes dist-eval/: the smoke-test build plus install-time access to the eval's
// targets (http://localhost for the stub node, https://agenticsystemcore.com for the live
// page), so `npm run eval:gpu` needs no click in Chrome's toolbar (scripts/eval/run.ts).
// `--demos` (implies `--eval`) adds one more install-time host, googlechromelabs.github.io, where
// Google's official WebMCP demo pages live, for the demo-page stage of the Chrome evaluation (scripts/eval/demos.ts). Never in dist/.
const demos = process.argv.includes('--demos');
const evalBuild = demos || process.argv.includes('--eval');
const smoke = evalBuild || process.argv.includes('--smoke');
const root = new URL('../', import.meta.url);
const outName = evalBuild ? 'dist-eval' : smoke ? 'dist-smoke' : 'dist';
const out = new URL(`${outName}/`, root);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = {
  bundle: true,
  platform: 'browser',
  target: 'chrome124',
  outdir: outName,
  minify: false,
  // Folds the build flag so smoke-test-only code is dropped; names and layout stay readable.
  minifySyntax: true,
  sourcemap: false,
  legalComments: 'eof',
  logLevel: 'warning',
  define: {
    __WEBAIASSIST_SMOKE__: String(smoke),
    __WEBAIASSIST_FAKE_CPU__: String(smoke && !evalBuild),
  },
};

await build({
  ...common,
  entryPoints: {
    'service-worker': 'src/entries/service-worker.ts',
    offscreen: 'src/entries/offscreen.ts',
    sidepanel: 'src/entries/sidepanel.ts',
    options: 'src/entries/options.ts',
    'model-worker': 'src/entries/model-worker.ts',
  },
  format: 'esm',
  splitting: true,
  plugins: [webLlmNoRemoteLibs, wllamaNoRemote],
  chunkNames: 'chunks/[name]-[hash]',
});

await build({
  ...common,
  entryPoints: {
    'content-isolated': 'src/entries/content-isolated.ts',
    'content-main': 'src/entries/content-main.ts',
    'webmcp-polyfill': 'src/entries/webmcp-polyfill.ts',
    ...(smoke ? { 'spike/spike': 'src/entries/spike-page.ts' } : {}),
  },
  format: 'iife',
});

/** Development-only markup (`<p data-dev-only>...</p>`, the browser check link) is left out
 *  of the release build. */
const DEV_ONLY = /^[ \t]*<p data-dev-only>[\s\S]*?<\/p>\n/gm;
for (const file of ['sidepanel.html', 'offscreen.html', 'options.html', 'ui.css']) {
  const text = readFileSync(new URL(`static/${file}`, root), 'utf8');
  writeFileSync(new URL(file, out), smoke ? text : text.replace(DEV_ONLY, ''));
}
if (smoke) cpSync(new URL('spike/index.html', root), new URL('spike/index.html', out));
cpSync(new URL('static/icons/', root), new URL('icons/', out), {
  recursive: true,
  filter: (source) => !source.endsWith('.svg'),
});
await bundleModelLibs(fileURLToPath(out));
cpSync(new URL('LICENSE', root), new URL('LICENSE', out));
cpSync(new URL('NOTICE', root), new URL('NOTICE', out));

const manifest = JSON.parse(readFileSync(new URL('static/manifest.json', root), 'utf8'));
manifest.version = pkg.version;
if (smoke) manifest.host_permissions = ['http://127.0.0.1/*', 'http://127.0.0.2/*'];
if (evalBuild) {
  manifest.host_permissions = [
    'http://127.0.0.1/*',
    'http://localhost/*',
    'https://agenticsystemcore.com/*',
    ...(demos ? ['https://googlechromelabs.github.io/*'] : []),
  ];
}
writeFileSync(new URL('manifest.json', out), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `${outName}/ written (version ${pkg.version}${demos ? ', eval build with the demo host' : evalBuild ? ', eval build' : smoke ? ', smoke-test build' : ''})`,
);
