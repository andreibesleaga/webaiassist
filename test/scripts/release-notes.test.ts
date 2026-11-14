// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { releaseNotes } from '../../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-12-01

### Fixed

- Two.

## [0.1.0] - 2026-11-13

### Added

- One.
`;

describe('releaseNotes', () => {
  it('gives the CHANGELOG section of one version, without its heading', () => {
    expect(releaseNotes(CHANGELOG, '0.2.0')).toBe('### Fixed\n\n- Two.');
    expect(releaseNotes(CHANGELOG, '0.1.0')).toBe('### Added\n\n- One.');
  });

  it('fails for a version the CHANGELOG does not have', () => {
    expect(() => releaseNotes(CHANGELOG, '9.9.9')).toThrow(/no section for 9\.9\.9/);
  });

  it('finds the section of the version in package.json', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version)).toMatch(/^### Added$/m);
  });
});
