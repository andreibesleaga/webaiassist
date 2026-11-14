// SPDX-License-Identifier: Apache-2.0
// `npm run eval:endpoint`: bundles scripts/eval/endpoint-run.ts (the sources import without file
// extensions) into a temporary folder and runs it. Reads the address, model and key from the
// environment only (see docs/EVAL.md); stops before any network call when they are not set.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'webaiassist-eval-endpoint-'));
const outfile = join(dir, 'endpoint-run.mjs');
try {
  await build({
    entryPoints: ['scripts/eval/endpoint-run.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'error',
  });
  await import(pathToFileURL(outfile).href);
} finally {
  // The run is async; remove the folder when the process ends.
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
}
