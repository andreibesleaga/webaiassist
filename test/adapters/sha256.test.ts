// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Base64 } from '../../src/adapters/sha256';

describe('sha256Base64', () => {
  it('equals the base64 SHA-256 of the same bytes', async () => {
    const bytes = new TextEncoder().encode('{"@graph":[]} é');
    expect(await sha256Base64(bytes)).toBe(createHash('sha256').update(bytes).digest('base64'));
  });

  it('knows the digest of nothing', async () => {
    expect(await sha256Base64(new Uint8Array())).toBe(
      '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    );
  });
});
