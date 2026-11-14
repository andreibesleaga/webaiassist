// SPDX-License-Identifier: Apache-2.0
// SHA-256 of bytes as base64, the form of the digests in a linkset (RFC 9530 `sha-256=:base64:`).
export async function sha256Base64(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return btoa(String.fromCharCode(...digest));
}
