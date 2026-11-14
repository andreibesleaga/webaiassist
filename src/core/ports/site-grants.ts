// SPDX-License-Identifier: Apache-2.0

/**
 * Port: the sites (origins) whose tools the user allowed in this browser session.
 * The extension keeps them in chrome.storage.session, which the browser clears on restart.
 */
export interface SiteGrants {
  has(origin: string): Promise<boolean>;
  add(origin: string): Promise<void>;
}
