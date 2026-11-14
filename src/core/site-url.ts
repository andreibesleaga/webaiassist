// SPDX-License-Identifier: Apache-2.0
// Just enough address handling for the site files, without the URL class (src/core has no
// browser types). Only http and https addresses count; the origin is compared in lower case
// with the default port left out, as a browser writes it.

const ABSOLUTE = /^(https?):\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?/i;

export interface Address {
  readonly origin: string;
  /** The address without a fragment. */
  readonly href: string;
}

function normalHost(scheme: string, host: string): string {
  const lower = host.toLowerCase();
  const port = scheme === 'https' ? ':443' : ':80';
  return lower.endsWith(port) ? lower.slice(0, -port.length) : lower;
}

/** An absolute http(s) address, or undefined. */
export function parseAddress(text: string): Address | undefined {
  const match = ABSOLUTE.exec(text.trim());
  if (!match) return undefined;
  const scheme = (match[1] ?? '').toLowerCase();
  const origin = `${scheme}://${normalHost(scheme, match[2] ?? '')}`;
  return { origin, href: `${origin}${match[3] ?? ''}${match[4] ?? ''}` };
}

/** `href` made absolute against `baseOrigin`: absolute addresses and paths that start with "/". */
export function resolveAddress(href: string, baseOrigin: string): Address | undefined {
  if (href.startsWith('/') && !href.startsWith('//')) return parseAddress(`${baseOrigin}${href}`);
  return parseAddress(href);
}
