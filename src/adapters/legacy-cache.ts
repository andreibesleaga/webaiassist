// SPDX-License-Identifier: Apache-2.0
// Version 0.1.0 ran the graphics-card models with another engine, which kept its files in the
// browser's Cache storage under these three names. This version never reads them, so after an
// update they would only take disk space (up to several gigabytes): they are removed once.

export const LEGACY_CACHES: readonly string[] = ['webllm/model', 'webllm/config', 'webllm/wasm'];

/** The part of CacheStorage this uses. */
export interface CacheStorageLike {
  delete(name: string): Promise<boolean>;
}

/** Deletes the old engine's caches; returns how many were there. One that cannot be deleted is
 *  left for the next update. */
export async function removeLegacyCaches(storage: CacheStorageLike): Promise<number> {
  let removed = 0;
  for (const name of LEGACY_CACHES) {
    if (await storage.delete(name).catch(() => false)) removed += 1;
  }
  return removed;
}
