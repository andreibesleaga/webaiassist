// SPDX-License-Identifier: Apache-2.0
// The "hosts contacted on Start" check: every host seen during a model download must be one
// docs/PRIVACY.md names (huggingface.co and Hugging Face's download network under hf.co),
// or the extension and the local test servers themselves.
const ALLOWED = ['huggingface.co', 'hf.co', '127.0.0.1', 'localhost'];

const allowed = (host: string): boolean =>
  host === '' || ALLOWED.some((name) => host === name || host.endsWith(`.${name}`));

/** Hosts (lower-case, no port) seen in `urls` that PRIVACY.md does not name. */
export function offHosts(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const text of urls) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      continue;
    }
    if (
      url.protocol === 'chrome-extension:' ||
      url.protocol === 'data:' ||
      url.protocol === 'blob:'
    )
      continue;
    const host = url.hostname.toLowerCase();
    if (!allowed(host)) seen.add(host);
  }
  return [...seen].sort();
}
