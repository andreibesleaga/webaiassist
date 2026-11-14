// SPDX-License-Identifier: Apache-2.0
// Supply-chain rules for the GitHub workflows: every action pinned to a full commit SHA
// (with the version as a comment), least-privilege permissions, no GPU, Node from .nvmrc.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = '.github/workflows';
const workflows = readdirSync(DIR)
  .filter((name) => name.endsWith('.yml'))
  .map((name) => ({ name, text: readFileSync(`${DIR}/${name}`, 'utf8') }));

describe('GitHub workflows', () => {
  it('are the test and release workflows', () => {
    expect(workflows.map((w) => w.name).sort()).toEqual(['release.yml', 'test.yml']);
  });

  it.each(workflows)('$name pins every action to a full commit SHA', ({ text }) => {
    const uses = [...text.matchAll(/uses:\s*(\S+)(.*)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [, ref, comment] of uses) {
      expect(ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(comment).toMatch(/# v\d+\.\d+\.\d+/);
    }
  });

  it.each(workflows)(
    '$name sets permissions and runs verify:release on Node from .nvmrc',
    ({ text }) => {
      expect(text).toMatch(/^permissions:\n {2}contents: (read|write)$/m);
      expect(text).toContain('node-version-file: .nvmrc');
      expect(text).toContain('npm run verify:release');
    },
  );

  it('gives write access only to the release workflow', () => {
    const writers = workflows.filter((w) => /contents: write/.test(w.text)).map((w) => w.name);
    expect(writers).toEqual(['release.yml']);
  });
});
