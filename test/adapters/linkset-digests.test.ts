// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { declaredDigests } from '../../src/adapters/linkset-digests';

const fixture = (name: string): string => readFileSync(`fixtures/graph/${name}`, 'utf8');

describe('declaredDigests', () => {
  const ORIGIN = 'https://agenticsystemcore.com';

  it('maps origin and path to the base64 SHA-256 of the live linkset', () => {
    const digests = declaredDigests(fixture('asc-linkset.json'), ORIGIN);
    expect(digests.get(`${ORIGIN}/graph.jsonld`)).toBe(
      '6qa2Rzt5n/Ttg1FXdFYVWTDL8HahOPKRJ9/irY7LgCg=',
    );
    expect(digests.get(`${ORIGIN}/chunks.jsonl`)).toBe(
      'jz8wKu8n0b+vYt7UznJQpphm+3nTHyrdSx0AQ7+FAyM=',
    );
  });

  it('keeps only addresses of the linkset’s own site, or of the origin it was read from', () => {
    const text = JSON.stringify({
      linkset: [
        {
          anchor: 'https://a.example/',
          describedby: [
            { href: 'https://a.example/graph.jsonld', digest: ['sha-256=:AAAA:'] },
            { href: 'https://evil.example/graph.jsonld', digest: ['sha-256=:BBBB:'] },
          ],
        },
      ],
    });
    const digests = declaredDigests(text, 'http://127.0.0.1:9');
    expect(digests.get('http://127.0.0.1:9/graph.jsonld')).toBe('AAAA');
    expect([...digests.keys()].some((key) => key.includes('evil'))).toBe(false);
  });

  it('ignores a digest that is not sha-256 and text that is not a linkset', () => {
    expect(declaredDigests('not json', ORIGIN).size).toBe(0);
    expect(declaredDigests('{"linkset":[]}', ORIGIN).size).toBe(0);
    const md5 = JSON.stringify({
      linkset: [
        { anchor: `${ORIGIN}/`, alternate: [{ href: `${ORIGIN}/x`, digest: ['md5=:AA==:'] }] },
      ],
    });
    expect(declaredDigests(md5, ORIGIN).size).toBe(0);
  });
});
