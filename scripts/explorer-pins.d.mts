// SPDX-License-Identifier: Apache-2.0
export interface Pin {
  file: string;
  bytes: number;
  sha256: string;
  from: string;
  to: string;
}
export interface Pins {
  sourceCommit: string;
  files: { file: string; bytes: number; sha256: string; siteBlockSha256?: string }[];
  forceGraph: { package: string; file: string; bytes: number; sha256: string };
}
export const PINS_DIR: string;
export const PINS: Pins;
export const EXPLORER_FOLDER: string;
export function explorerFiles(pins?: Pins, base?: string): Pin[];
export function pinProblems(pin: Pin, bytes: Uint8Array | undefined): string[];
export function explorerProblems(pins?: Pins, base?: string): string[];
export function copyExplorer(outDir: string): void;
