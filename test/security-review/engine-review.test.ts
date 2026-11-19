// SPDX-License-Identifier: Apache-2.0
// One local engine (llama.cpp in WebAssembly): the old WebLLM engine and its compiled model
// libraries are gone, and the two pinned engine files name the package versions that are installed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pins from '../../scripts/model-libs.json';

const ROOT = process.cwd();
const json = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Record<string, unknown>;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(ROOT, path)).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('the old WebLLM engine is gone', () => {
  it('package.json has no dependency named mlc or web-llm', () => {
    const pkg = json('package.json');
    for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const names = Object.keys((pkg[group] as Record<string, string> | undefined) ?? {});
      expect(
        names.filter((name) => /mlc|web-llm/i.test(name)),
        group,
      ).toEqual([]);
    }
  });

  it('no file under src/ imports from @mlc-ai/', () => {
    const offenders = sourceFiles('src').filter((path) =>
      /@mlc-ai\//.test(readFileSync(join(ROOT, path), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('the engine pins in scripts/model-libs.json', () => {
  it('pins exactly two engine files', () => {
    expect(Object.keys(pins)).toEqual(['runtimes']);
    expect(pins.runtimes.map((r) => r.file).sort()).toEqual(['oxigraph.wasm', 'wllama.wasm']);
  });

  it.each(pins.runtimes.map((r) => [r.file, r] as const))(
    '%s names its npm package with an exact version equal to the installed one',
    (_file, pin) => {
      const at = pin.package.lastIndexOf('@');
      const name = pin.package.slice(0, at);
      const version = pin.package.slice(at + 1);
      expect(name.length).toBeGreaterThan(0);
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      const installed = join('node_modules', name, 'package.json');
      expect(existsSync(join(ROOT, installed)), installed).toBe(true);
      expect(json(installed).version).toBe(version);
      expect(pin.from.startsWith(`node_modules/${name}/`)).toBe(true);
    },
  );
});
