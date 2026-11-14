// SPDX-License-Identifier: Apache-2.0
// The host of the chat endpoint address, for sentences that tell where the chat goes.

/** The host (and port) of an address, or the text itself when it is not an address. */
export function endpointHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
