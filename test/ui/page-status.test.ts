// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import {
  allowLabel,
  errorStatus,
  statusOf,
  statusText,
  accessBadge,
  siteName,
} from '../../src/ui/page-status';
import { t } from '../../src/ui/i18n';
import { AGSC_TOOLS } from '../helpers';

const SITE = 'https://agenticsystemcore.com';
const one = [{ name: 'add', description: 'Adds.' }];

describe('page status line', () => {
  it('names the site and counts its WebMCP tools', () => {
    const page = { origin: SITE, linkset: false, tools: one };
    expect(statusText(statusOf(page))).toBe('agenticsystemcore.com — 1 WebMCP tool');
    const local = { origin: 'http://127.0.0.1:8080', linkset: false, tools: [...one, ...one] };
    expect(statusText(statusOf(local))).toBe('127.0.0.1:8080 — 2 WebMCP tools');
  });

  it('says when the page is an AgenticSystemCore node, with or without tools', () => {
    const item = { origin: SITE, linkset: true, tools: AGSC_TOOLS };
    expect(statusText(statusOf(item))).toBe(
      'agenticsystemcore.com — says it is an AgenticSystemCore node, 10 WebMCP tools',
    );
    const home = { origin: SITE, linkset: true, tools: [] };
    expect(statusText(statusOf(home))).toMatch(
      /^agenticsystemcore\.com — says it is an AgenticSystemCore node; no WebMCP tools on this page/,
    );
  });

  it('reports a page without tools as a plain state, not an error', () => {
    const page = { origin: 'https://example.org', linkset: false, tools: [] };
    expect(statusText(statusOf(page))).toBe(
      'example.org — no WebMCP tools (use Read this page or Add WebMCP to this site)',
    );
    expect(allowLabel(statusOf(page))).toBeUndefined();
  });

  it('offers Allow on a site that is not allowed yet', () => {
    const unknown = errorStatus(new PageError('not allowed', undefined, 'denied'));
    expect(statusText(unknown)).toBe('This page — not allowed yet');
    expect(allowLabel(unknown)).toBe('Allow WebAIAssist on this site');
    const known = errorStatus(new PageError('not allowed', SITE, 'denied'));
    expect(statusText(known)).toBe('agenticsystemcore.com — not allowed yet');
    expect(allowLabel(known)).toBe('Allow WebAIAssist on agenticsystemcore.com');
  });

  it('says plainly where the extension cannot run, with no Allow', () => {
    const status = errorStatus(new PageError('chrome://', undefined, 'restricted'));
    expect(statusText(status)).toBe(
      'This page — WebAIAssist cannot run here (chrome:// pages, the store)',
    );
    expect(allowLabel(status)).toBeUndefined();
  });

  it('shows why a listing failed, and the empty state', () => {
    expect(statusText(errorStatus(new PageError('timeout', SITE)))).toBe(
      'agenticsystemcore.com — the page did not list its tools: timeout',
    );
    expect(statusText(errorStatus(new Error('gone')))).toBe(
      'This page — the page did not list its tools: gone',
    );
    expect(statusText({ kind: 'none' })).toBe('No page yet.');
  });
});

describe('the access badge of the card', () => {
  const origin = 'https://a.example';
  it.each([
    [{ kind: 'none' }, 'No page', 'neutral'],
    [{ kind: 'restricted' }, 'Cannot run here', 'neutral'],
    [{ kind: 'not-allowed', origin }, 'Not allowed yet', 'neutral'],
    [{ kind: 'tools', origin, count: 2, node: false }, 'Allowed', 'ok'],
    [{ kind: 'tools', origin, count: 0, node: true }, 'Allowed', 'ok'],
    [{ kind: 'failed', origin, why: 'timed out' }, 'Allowed', 'ok'],
    [
      { kind: 'tools', origin, count: 2, node: false, blocked: true },
      'Blocked by the site',
      'warn',
    ],
  ] as const)('%j shows "%s" in the %s tone', (status, text, tone) => {
    const badge = accessBadge(status);
    expect(t(badge.key)).toBe(text);
    expect(badge.tone).toBe(tone);
  });
});

describe('the site name of the card heading', () => {
  it('is the host, or "This page" when the site is not known', () => {
    expect(
      siteName({ kind: 'tools', origin: 'http://127.0.0.1:8080', count: 1, node: false }),
    ).toBe('127.0.0.1:8080');
    expect(siteName({ kind: 'not-allowed' })).toBe('This page');
    expect(siteName({ kind: 'restricted' })).toBe('This page');
    expect(siteName({ kind: 'none' })).toBe('This page');
  });
});
