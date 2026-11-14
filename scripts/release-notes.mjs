// SPDX-License-Identifier: Apache-2.0
// Prints the CHANGELOG.md section of one version, for the GitHub release text.
// Run: node scripts/release-notes.mjs 0.1.0
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function releaseNotes(changelog, version) {
  const heading = new RegExp(`^## \\[${escape(version)}\\][^\\n]*\\n`, 'm');
  const match = heading.exec(changelog);
  if (!match) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const rest = changelog.slice(match.index + match[0].length);
  const end = rest.search(/^## /m);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  console.log(releaseNotes(changelog, process.argv[2] ?? ''));
}
