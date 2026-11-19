// SPDX-License-Identifier: Apache-2.0
// A model file above 2 GiB cannot be hashed in one call in the browser (found on 18 Nov 2026 with
// the 3.1 GB Gemma 4 E2B file: "The ArrayBuffer size exceeds the supported range"). Such a file
// carries the SHA-256 of each 1 GiB piece and is checked piece by piece.
import { describe, expect, it } from 'vitest';
import {
  findGpuModel,
  LOCAL_FILES,
  ONE_DIGEST_MAX,
  PART_BYTES,
  type CpuModel,
} from '../../src/adapters/cpu-models';
import { sha256OfBlob, sha256OfParts } from '../../src/adapters/sha256-parts';
import { newDisk, noProgress, setup } from './wllama-fakes';

const GEMMA = 'gemma-4-e2b-it-q4_k_m';
const gemma = findGpuModel(GEMMA) as CpuModel;
const parts = gemma.parts ?? [];

describe('the recorded piece hashes', () => {
  it('every file above one call has one SHA-256 for each 1 GiB piece, and no smaller file has any', () => {
    for (const model of LOCAL_FILES) {
      if (model.bytes > ONE_DIGEST_MAX) {
        expect(model.parts?.length, model.id).toBe(Math.ceil(model.bytes / PART_BYTES));
        for (const hash of model.parts ?? []) expect(hash, model.id).toMatch(/^[0-9a-f]{64}$/);
      } else {
        expect(model.parts, model.id).toBeUndefined();
      }
    }
    expect(gemma.bytes).toBeGreaterThan(ONE_DIGEST_MAX);
    expect(parts).toHaveLength(3);
  });
});

describe('a model file above 2 GiB', () => {
  it('is downloaded, checked piece by piece, remembered and loaded', async () => {
    const { runtime, engines, disk } = setup(newDisk(), () => {}, 'gpu');
    await runtime.load(GEMMA, noProgress);
    const [engine] = engines;
    expect(engine?.downloads).toEqual([gemma.url]);
    expect(engine?.partSizes).toEqual([PART_BYTES]);
    expect(engine?.loads).toEqual([gemma.url]);
    expect(disk.checked.get(gemma.url)).toBe(gemma.sha256);
  });

  it('starts from the checked copy without a new hash', async () => {
    const first = setup(newDisk(), () => {}, 'gpu');
    await first.runtime.load(GEMMA, noProgress);
    const second = setup(first.disk, () => {}, 'gpu');
    await second.runtime.load(GEMMA, noProgress);
    expect(second.engines[0]?.downloads).toEqual([]);
    expect(second.engines[0]?.hashed).toEqual([]);
    expect(second.engines[0]?.loads).toEqual([gemma.url]);
  });

  it('is refused and deleted when one piece differs', async () => {
    const wrong = [parts[0] ?? '', 'e'.repeat(64), parts[2] ?? ''];
    const bad = setup(
      newDisk(),
      (e) => (e.serves = { bytes: gemma.bytes, sha256: gemma.sha256, parts: wrong }),
      'gpu',
    );
    await expect(bad.runtime.load(GEMMA, noProgress)).rejects.toThrow(
      /did not match its checksum and was deleted/,
    );
    expect(bad.disk.files.has(gemma.url)).toBe(false);
    expect(bad.disk.checked.has(gemma.url)).toBe(false);
    expect(bad.engines[0]?.loads).toEqual([]);
  });

  it('is refused when a piece is missing, even if the pieces present are right', async () => {
    const bad = setup(
      newDisk(),
      (e) => (e.serves = { bytes: gemma.bytes, sha256: gemma.sha256, parts: parts.slice(0, 2) }),
      'gpu',
    );
    await expect(bad.runtime.load(GEMMA, noProgress)).rejects.toThrow(/did not match/);
    expect(bad.engines[0]?.loads).toEqual([]);
  });
});

describe('sha256OfParts', () => {
  const bytes = Uint8Array.from({ length: 10 }, (_, i) => i * 7);

  it('hashes each consecutive piece, the last one shorter', async () => {
    const found = await sha256OfParts(new Blob([bytes]), 4);
    expect(found).toEqual([
      await sha256OfBlob(new Blob([bytes.slice(0, 4)])),
      await sha256OfBlob(new Blob([bytes.slice(4, 8)])),
      await sha256OfBlob(new Blob([bytes.slice(8)])),
    ]);
  });

  it('gives the whole file’s hash as its one piece when the file is not larger than a piece', async () => {
    expect(await sha256OfParts(new Blob([bytes]), 10)).toEqual([
      await sha256OfBlob(new Blob([bytes])),
    ]);
    expect(await sha256OfParts(new Blob([]), 4)).toEqual([]);
  });

  it('matches a known SHA-256 ("abc")', async () => {
    expect(await sha256OfBlob(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
