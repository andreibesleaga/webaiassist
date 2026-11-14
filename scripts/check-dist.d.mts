// SPDX-License-Identifier: Apache-2.0
export type Variant = 'release' | 'smoke' | 'eval' | 'demos';
export declare const EXPECTED_PERMISSIONS: readonly string[];
export declare const EXPECTED_OPTIONAL_HOSTS: readonly string[];
export declare const EXPECTED_CSP: string;
export declare const DEMO_HOSTS: readonly string[];
export declare function checkManifest(
  manifest: Record<string, unknown>,
  exists: (path: string) => boolean,
  variant?: Variant,
): string[];
export declare function checkBundles(texts: Record<string, string>, variant: Variant): string[];
export declare function checkDevOnly(paths: string[], texts: Record<string, string>): string[];
export declare function builtFiles(dir: string): string[];
