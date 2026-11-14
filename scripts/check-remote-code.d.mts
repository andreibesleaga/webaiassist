// SPDX-License-Identifier: Apache-2.0
export interface LibPins {
  readonly libs: readonly {
    readonly file: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
  /** Engines (.wasm) copied from an installed package, pinned the same way. */
  readonly runtimes?: readonly {
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
