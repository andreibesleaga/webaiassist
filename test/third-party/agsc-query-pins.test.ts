// SPDX-License-Identifier: Apache-2.0
// The query engine files of agentic-system-core 1.1.0 are copied, not rewritten: every copy must
// equal its pin; oxigraph's web.js and wasm must be the pinned bytes, and the wasm pin in
// scripts/model-libs.json must be the same file. No network and no sibling repository needed. A
// last test compares the pins with the engine repository when AGSC_ENGINE_REPO points at it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNTIMES } from '../../scripts/model-libs.mjs';
import { pinProblems, QUERY_DIR, QUERY_PINS, queryProblems } from '../../scripts/query-pins.mjs';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('the copied query files equal their pins', () => {
  it('has no problem: size and SHA-256 of every copy and of oxigraph web.js', () => {
    expect(queryProblems()).toEqual([]);
  });

  it('pins the three engine files and the question list, with the tag and its commit', () => {
    expect(QUERY_PINS.files.map((file) => file.file)).toEqual([
      'tokens.js',
      'engine.js',
      'view.js',
      'ontology-questions.json',
    ]);
    expect(QUERY_PINS.sourceTag).toBe('v1.1.0');
    expect(QUERY_PINS.sourceTagCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(QUERY_PINS.oxigraph.package).toBe('oxigraph@0.5.13');
  });

  it('notices a changed byte, a different size and a missing file', () => {
    const pin = QUERY_PINS.files[0];
    if (!pin) throw new Error('no pin');
    const bytes = readFileSync(join(QUERY_DIR, pin.file));
    expect(pinProblems(pin, bytes)).toEqual([]);
    const changed = Buffer.from(bytes);
    changed[0] = (changed[0] ?? 0) ^ 1;
    expect(pinProblems(pin, changed)[0]).toMatch(/SHA-256/);
    expect(pinProblems(pin, bytes.subarray(1))[0]).toMatch(/bytes, not/);
    expect(pinProblems(pin, undefined)[0]).toMatch(/missing/);
  });

  it('keeps the wasm pin of the build the same file as the one pinned here', () => {
    const runtime = RUNTIMES.find((item) => item.file === 'oxigraph.wasm');
    expect(runtime?.package).toBe('oxigraph@0.5.13');
    expect(runtime?.sha256).toBe(QUERY_PINS.oxigraph.wasm.sha256);
    expect(runtime?.bytes).toBe(QUERY_PINS.oxigraph.wasm.bytes);
  });
});

describe('the pins against the engine repository (set AGSC_ENGINE_REPO to run)', () => {
  const repo = process.env.AGSC_ENGINE_REPO;
  it.runIf(repo !== undefined && existsSync(repo))('are the files of the tag', () => {
    for (const pin of QUERY_PINS.files) {
      const bytes = execFileSync('git', ['-C', repo ?? '', 'show', `v1.1.0:${pin.source}`]);
      expect(sha256(bytes), `${pin.file}: run node scripts/sync-agsc-query.mjs`).toBe(pin.sha256);
    }
  });
});
