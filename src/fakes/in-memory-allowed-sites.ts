// SPDX-License-Identifier: Apache-2.0
import type { AllowedSites } from '../core/ports/allowed-sites';

/** AllowedSites kept in a Set; the same behaviour as the storage adapter. */
export class InMemoryAllowedSites implements AllowedSites {
  private readonly sites = new Set<string>();

  has(origin: string): Promise<boolean> {
    return Promise.resolve(this.sites.has(origin));
  }

  add(origin: string): Promise<void> {
    this.sites.add(origin);
    return Promise.resolve();
  }

  remove(origin: string): Promise<void> {
    this.sites.delete(origin);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.sites.clear();
    return Promise.resolve();
  }
}
