// SPDX-License-Identifier: Apache-2.0
export interface OnLoadArgs {
  readonly path: string;
}
export interface BuildLike {
  onLoad(
    options: { filter: RegExp },
    callback: (args: OnLoadArgs) => { contents: string; loader: string },
  ): void;
}
export interface EsbuildPlugin {
  readonly name: string;
  setup(build: BuildLike): void;
}
export declare const wllamaNoRemote: EsbuildPlugin;
export declare const RUNTIMES: readonly {
  readonly package: string;
  readonly file: string;
  readonly from: string;
  readonly bytes: number;
  readonly sha256: string;
}[];
export declare function pinnedWasmPaths(pins?: {
  readonly runtimes: readonly { readonly file: string }[];
}): string[];
