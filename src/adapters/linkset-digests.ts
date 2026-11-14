// SPDX-License-Identifier: Apache-2.0
// The SHA-256 digests a linkset declares for its targets (RFC 9530 `sha-256=:base64:`). Uses the
// URL class, so it lives with the adapters, not in src/core.

type Entry = Record<string, unknown>;
const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const originOf = (href: string, base?: string): string | undefined => {
  try {
    return new URL(href, base).origin;
  } catch {
    return undefined;
  }
};

/**
 * The SHA-256 digests (RFC 9530 `sha-256=:base64:`) a linkset declares for its targets, as a map
 * from "origin + path" to the base64 value. `requestOrigin` is where the linkset was read from:
 * a target counts when it is on that origin or on the origin of the linkset's own anchor (a
 * node served from another address than the one it names), never on a third origin.
 */
export function declaredDigests(raw: string, requestOrigin: string): ReadonlyMap<string, string> {
  const digests = new Map<string, string>();
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return digests;
  }
  const list: unknown = isEntry(root) ? root.linkset : undefined;
  const context: unknown = Array.isArray(list) ? list[0] : undefined;
  if (!isEntry(context)) return digests;
  const anchorOrigin = typeof context.anchor === 'string' ? originOf(context.anchor) : undefined;
  for (const items of Object.values(context)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) addDigest(digests, item, requestOrigin, anchorOrigin);
  }
  return digests;
}

function addDigest(
  digests: Map<string, string>,
  item: unknown,
  requestOrigin: string,
  anchorOrigin: string | undefined,
): void {
  if (!isEntry(item) || typeof item.href !== 'string' || !Array.isArray(item.digest)) return;
  const origin = originOf(item.href, anchorOrigin);
  const value = /^sha-256=:([A-Za-z0-9+/=]+):$/.exec(String(item.digest[0]))?.[1];
  if (origin === undefined || value === undefined) return;
  if (origin !== requestOrigin && origin !== anchorOrigin) return;
  digests.set(`${requestOrigin}${new URL(item.href, requestOrigin).pathname}`, value);
}
