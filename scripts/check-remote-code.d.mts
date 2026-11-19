// SPDX-License-Identifier: Apache-2.0
export interface LibPins {
  /** Engines (.wasm) copied from an installed package, pinned by size and SHA-256. */
  readonly runtimes: readonly {
    readonly file: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}
export declare function checkRemoteCode(texts: Record<string, string>): string[];
export declare function checkModelLibFiles(
  files: readonly string[],
  read: (path: string) => Uint8Array,
  pins?: LibPins,
): string[];
