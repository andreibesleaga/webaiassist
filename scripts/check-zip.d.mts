// SPDX-License-Identifier: Apache-2.0
import type { LibPins } from './check-remote-code.mjs';
export declare const MAX_ZIP_BYTES: number;
export declare function checkZip(input: {
  entries: Record<string, Uint8Array>;
  size: number;
  version: string;
  distFiles: readonly string[];
  pins?: LibPins;
}): string[];
