// SPDX-License-Identifier: Apache-2.0
// Adversarial pass, part 3 (docs/THREAT-MODEL.md, attempt 10): a conversation export that
// would carry the endpoint API key. The key can reach the transcript when the user pastes
// it, or when a page tool echoes it back.
import { describe, expect, it } from 'vitest';
import { exportMarkdown, type TranscriptEntry } from '../../src/core/export';

const KEY = 'sk-live-0123456789abcdef';
const meta = {
  origin: 'https://shop.example',
  at: '2026-01-01T00:00:00Z',
  model: 'm',
  version: '0.1.0',
};

describe('attempt 10: an export containing a key', () => {
  const entries: TranscriptEntry[] = [
    { kind: 'user', text: `my key is ${KEY}, keep it` },
    { kind: 'tool-call', name: 'login', args: { note: KEY, bearer: 'abc', privateKey: 'pk' } },
    { kind: 'tool-result', name: 'login', ok: true, text: `{"echo":"${KEY}"}` },
    { kind: 'answer', text: `Your key ${KEY} works.` },
  ];

  it('replaces the configured key everywhere in the file', () => {
    const markdown = exportMarkdown(entries, { ...meta, secrets: [KEY] });
    expect(markdown).not.toContain(KEY);
    expect(markdown.match(/\[redacted\]/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('hides argument values named like secrets, bearer and private keys included', () => {
    const markdown = exportMarkdown(entries, { ...meta, secrets: [] });
    expect(markdown).not.toMatch(/"abc"|"pk"/);
  });

  it('ignores an empty or very short secret, which would redact ordinary text', () => {
    const markdown = exportMarkdown([{ kind: 'user', text: 'a b c' }], {
      ...meta,
      secrets: ['', 'a'],
    });
    expect(markdown).toContain('a b c');
  });
});
