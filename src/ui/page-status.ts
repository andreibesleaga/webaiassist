// SPDX-License-Identifier: Apache-2.0
// The page status line at the top of the side panel: which site the panel works on and what
// it offers. "agenticsystemcore.com — 10 WebMCP tools", "— no WebMCP tools (...)",
// "— not allowed yet" (with an Allow button), "— cannot run here", or why listing failed.
// A page without tools is a plain state, never an error.
import { PageError, type PageInfo } from '../adapters/messaging-tool-bridge';
import { isAgscNode } from '../core/node-mode';
import { t } from './i18n';
import type { MessageKey } from './messages-en';

export type PageStatus =
  | {
      readonly kind: 'tools';
      readonly origin: string;
      readonly count: number;
      readonly node: boolean;
      /** The site asks that AI does not use its content as input (and nothing overrides it). */
      readonly blocked?: boolean;
    }
  | { readonly kind: 'not-allowed'; readonly origin?: string }
  | { readonly kind: 'restricted' }
  | { readonly kind: 'failed'; readonly origin?: string; readonly why: string }
  | { readonly kind: 'none' };

export interface StatusOptions {
  /** The node check made with what the site published; the page's own link counts when absent. */
  readonly node?: boolean;
  readonly blocked?: boolean;
}

export function statusOf(info: PageInfo, options: StatusOptions = {}): PageStatus {
  const node =
    options.node ?? isAgscNode({ linkset: info.linkset, toolNames: info.tools.map((x) => x.name) });
  const blocked = options.blocked === true ? { blocked: true } : {};
  return { kind: 'tools', origin: info.origin, count: info.tools.length, node, ...blocked };
}

export function errorStatus(error: unknown): PageStatus {
  const why = error instanceof Error ? error.message : String(error);
  if (!(error instanceof PageError)) return { kind: 'failed', why };
  const origin = error.origin === undefined ? {} : { origin: error.origin };
  if (error.access === 'restricted') return { kind: 'restricted' };
  if (error.access === 'denied') return { kind: 'not-allowed', ...origin };
  return { kind: 'failed', ...origin, why };
}

/** "agenticsystemcore.com", "127.0.0.1:8080"; "This page" when the site is not known. */
function hostOf(origin: string | undefined): string {
  if (origin === undefined) return t('thisPage');
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

function toolsText(status: Extract<PageStatus, { kind: 'tools' }>): string {
  const host = hostOf(status.origin);
  const count = status.count;
  if (status.blocked === true) return t('pageBlocked', { host });
  if (count === 0) return t(status.node ? 'pageNodeNoTools' : 'pageNoTools', { host });
  if (status.node) return t('pageNode', { host, count });
  return t(count === 1 ? 'pageTool' : 'pageTools', { host, count });
}

export function statusText(status: PageStatus): string {
  switch (status.kind) {
    case 'tools':
      return toolsText(status);
    case 'not-allowed':
      return t('pageNotAllowed', { host: hostOf(status.origin) });
    case 'restricted':
      return t('pageRestricted');
    case 'failed':
      return t('pageFailed', { host: hostOf(status.origin), why: status.why });
    case 'none':
      return t('pageNone');
  }
}

/** The Allow button's label, only while the site is not allowed yet. */
export function allowLabel(status: PageStatus): string | undefined {
  if (status.kind !== 'not-allowed') return undefined;
  return status.origin === undefined
    ? t('allowHere')
    : t('allowOn', { host: hostOf(status.origin) });
}

export interface AccessBadge {
  readonly key: MessageKey;
  /** Colour is never the only signal: the badge always carries its words. */
  readonly tone: 'ok' | 'neutral' | 'warn';
}

/** The short word at the end of the site row: what WebAIAssist may do with this page. */
export function accessBadge(status: PageStatus): AccessBadge {
  switch (status.kind) {
    case 'none':
      return { key: 'badgeNone', tone: 'neutral' };
    case 'restricted':
      return { key: 'badgeRestricted', tone: 'neutral' };
    case 'not-allowed':
      return { key: 'badgeNotAllowed', tone: 'neutral' };
    case 'tools':
      return status.blocked === true
        ? { key: 'badgeBlocked', tone: 'warn' }
        : { key: 'badgeAllowed', tone: 'ok' };
    case 'failed':
      return { key: 'badgeAllowed', tone: 'ok' };
  }
}

/** The name of the site for the card heading: "example.com", "This page" when not known. */
export function siteName(status: PageStatus): string {
  return 'origin' in status ? hostOf(status.origin) : t('thisPage');
}
