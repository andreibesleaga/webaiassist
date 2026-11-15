// SPDX-License-Identifier: Apache-2.0
export interface ManifestTexts {
  readonly extDescription: string;
  readonly extActionTitle: string;
}
export declare function chromeMessages(
  dictionary: Readonly<Record<string, string>>,
  manifestTexts: ManifestTexts,
): Record<string, { message: string }>;
export declare function localiseManifest<
  M extends { description: string; action: { default_title: string } },
>(manifest: M): { manifest: M & { default_locale: string }; texts: ManifestTexts };
