// SPDX-License-Identifier: Apache-2.0
// `node scripts/gpu-check/run.ts [--channel chrome|chromium] [--model <id>] [--words <n>]`:
// does WebLLM generate on this computer's GPU at all, outside the extension? It bundles
// entry.ts, serves it on the loopback, opens a visible browser and runs one load and one chat
// (the model's weights and library come from WebLLM's own CDN; this is a diagnostic, not the
// extension's no-remote-code build). Prints one JSON line per model and the browser console.
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    channel: { type: 'string', default: 'chromium' },
    model: { type: 'string', default: 'Qwen3-0.6B-q4f16_1-MLC,Qwen3-0.6B-q4f32_1-MLC' },
    words: { type: 'string', default: '600' },
    chunk: { type: 'string', default: '0' },
  },
});
const dir = mkdtempSync(join(tmpdir(), 'webaiassist-gpu-check-'));
await build({
  entryPoints: ['scripts/gpu-check/entry.ts'],
  bundle: true,
  format: 'esm',
  target: 'chrome124',
  outfile: join(dir, 'entry.js'),
  logLevel: 'silent',
});
writeFileSync(join(dir, 'index.html'), readFileSync('scripts/gpu-check/page.html'));
const server = createServer((request, response) => {
  const file = request.url === '/entry.js' ? 'entry.js' : 'index.html';
  const type = file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
  response.writeHead(200, { 'content-type': type }).end(readFileSync(join(dir, file)));
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
const browser = await chromium.launch({
  headless: false,
  channel: values.channel === 'chrome' ? 'chrome' : undefined,
});
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().startsWith('[gpu-check]'))
    console.log(`  ${m.type()}: ${m.text().slice(0, 300)}`);
});
page.on('pageerror', (e) => console.log(`  pageerror: ${String(e).slice(0, 300)}`));
await page.goto(url);
console.log(
  `browser ${browser.version()} (${values.channel}); ${await page.evaluate(() => navigator.userAgent)}`,
);
for (const model of values.model.split(',')) {
  console.log(`model ${model}`);
  const outcome = await page.evaluate(
    ([id, words, chunk]) =>
      (
        globalThis as unknown as { gpuCheck: (m: string, w: number, c: number) => Promise<unknown> }
      ).gpuCheck(id, Number(words), Number(chunk)),
    [model, values.words, values.chunk] as const,
  );
  console.log(JSON.stringify(outcome));
  await page.reload();
}
await browser.close();
server.close();
