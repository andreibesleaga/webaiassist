// SPDX-License-Identifier: Apache-2.0
export interface QueryPin {
  file: string;
  bytes: number;
  sha256: string;
  source?: string;
}
export interface QueryPins {
  sourceTag: string;
  sourceTagCommit: string;
  sourceHeadCommit: string;
  files: QueryPin[];
  oxigraph: {
    package: string;
    webJs: { bytes: number; sha256: string };
    wasm: { bytes: number; sha256: string };
  };
}
export const QUERY_DIR: string;
export const QUERY_PINS: QueryPins;
export function pinProblems(pin: QueryPin, bytes: Uint8Array | undefined): string[];
export function queryProblems(pins?: QueryPins, base?: string): string[];
export function checkQueryPins(): void;
