// SPDX-License-Identifier: Apache-2.0

/**
 * Port: the sites (origins) the user explicitly allowed WebAIAssist on, kept across browser
 * restarts. A host permission alone does not make a site allowed: the chat endpoint's host is a
 * host permission too, and it is not a site whose tools or files the extension may read.
 */
export interface AllowedSites {
  has(origin: string): Promise<boolean>;
  add(origin: string): Promise<void>;
  remove(origin: string): Promise<void>;
  clear(): Promise<void>;
}
