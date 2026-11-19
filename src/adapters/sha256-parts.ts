// SPDX-License-Identifier: Apache-2.0
// SHA-256 of a stored model file, as lower-case hex, with the browser's own Web Cryptography
// API. One call takes one buffer of at most 2 GiB, so a larger file is hashed in pieces
// (CpuModel.parts in cpu-models.ts) with one piece in memory at a time.

export const sha256OfBlob = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** The SHA-256 of each consecutive piece of `partBytes` (the last one shorter). */
export const sha256OfParts = async (blob: Blob, partBytes: number): Promise<string[]> => {
  const hashes: string[] = [];
  for (let start = 0; start < blob.size; start += partBytes) {
    hashes.push(await sha256OfBlob(blob.slice(start, start + partBytes)));
  }
  return hashes;
};
