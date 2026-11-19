// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { LEGACY_CACHES, removeLegacyCaches } from '../../src/adapters/legacy-cache';

/** A cache storage that holds `present`, records every delete, and throws for `broken`. */
function storage(present: string[], broken: string[] = []) {
  const asked: string[] = [];
  return {
    asked,
    delete: (name: string): Promise<boolean> => {
      asked.push(name);
      if (broken.includes(name)) return Promise.reject(new Error('locked'));
      return Promise.resolve(present.includes(name));
    },
  };
}

describe('removeLegacyCaches', () => {
  it('names exactly the three caches of version 0.1.0', () => {
    expect(LEGACY_CACHES).toEqual(['webllm/model', 'webllm/config', 'webllm/wasm']);
  });

  it('deletes exactly those three names and counts the ones that existed', async () => {
    const some = storage(['webllm/model', 'webllm/wasm', 'something-else']);
    expect(await removeLegacyCaches(some)).toBe(2);
    expect(some.asked).toEqual(LEGACY_CACHES);
    expect(await removeLegacyCaches(storage([]))).toBe(0);
    expect(await removeLegacyCaches(storage([...LEGACY_CACHES]))).toBe(3);
  });

  it('counts a delete that throws as not removed and still tries the others', async () => {
    const some = storage([...LEGACY_CACHES], ['webllm/model']);
    expect(await removeLegacyCaches(some)).toBe(2);
    expect(some.asked).toEqual(LEGACY_CACHES);
  });
});
