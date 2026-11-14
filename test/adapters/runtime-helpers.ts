// SPDX-License-Identifier: Apache-2.0
// Fakes shared by the model runtime tests. No real engine is ever loaded.

/** An async iterable over the given items, optionally aborting after `stopAfter` items. */
export async function* items<T>(list: readonly T[], onEach?: (index: number) => void) {
  for (const [index, item] of list.entries()) {
    onEach?.(index);
    await Promise.resolve();
    yield item;
  }
}
