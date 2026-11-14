// SPDX-License-Identifier: Apache-2.0
// Shared by the explorer's browser tests (explorer.spec.ts and the steps of features/21): a stub
// node served by the test server, a stub peer, and the way the panel's Graph chip opens the tab.
// The files are those recorded from the live nodes (fixtures/graph); tests never use the network.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { AGSC_PROFILE } from '../../src/core/site-linkset';
import { openPage, openPanelFor, type Session } from './harness';

export const fixture = (name: string): string => readFileSync(`fixtures/graph/${name}`, 'utf8');
export const base64 = (text: string): string => createHash('sha256').update(text).digest('base64');
export const ASC = 'https://agenticsystemcore.com';
export const PEER = 'https://peer.example';

export interface NodeFiles {
  graph?: string;
  /** The digest the linkset declares for the graph; by default the digest of `graph`. */
  declared?: string;
  peers?: string[];
}

/** Makes the stub server publish a node at `origin` (its linkset names the node's own files). */
export function serveNode(session: Session, origin: string, files: NodeFiles = {}): void {
  const graph = files.graph ?? fixture('asc-graph.jsonld');
  const linkset = fixture('asc-linkset.json').replaceAll(ASC, origin);
  const parsed = JSON.parse(linkset) as { linkset: Record<string, unknown>[] };
  const context = parsed.linkset[0] ?? {};
  const describedby = (context.describedby as { digest: string[] }[])[0];
  if (describedby) describedby.digest = [`sha-256=:${files.declared ?? base64(graph)}:`];
  if (files.peers) {
    context['https://w3id.org/agentic-system-core/rel#peer'] = files.peers.map((href) => ({
      href,
      type: 'application/linkset+json',
    }));
  }
  const profile = `application/linkset+json; profile="${AGSC_PROFILE}"`;
  const { routes } = session.site;
  routes.set('/.well-known/knowledge-linkset', { type: profile, body: JSON.stringify(parsed) });
  routes.set('/graph.jsonld', { type: 'application/ld+json; charset=utf-8', body: graph });
  routes.set('/chunks.jsonl', { type: 'application/jsonl', body: fixture('asc-chunks.jsonl') });
}

/** Answers the stub peer (https://peer.example, no real network). Playwright does not apply CORS to
 *  an answer it makes itself, so a peer that sends no CORS header is stood for by a blocked request:
 *  the page sees the same "Failed to fetch". */
export async function routePeer(
  context: Session['context'],
  log: string[],
  mode: 'serve' | 'block',
): Promise<void> {
  await context.route(/^https:\/\/peer\.example\//, (route) => {
    const url = new URL(route.request().url());
    log.push(url.pathname);
    if (mode === 'block') return route.abort('failed');
    const headers = { 'access-control-allow-origin': '*' };
    const files: Record<string, [string, string]> = {
      '/.well-known/knowledge-linkset': ['application/linkset+json', fixture('pat-linkset.json')],
      '/graph.jsonld': ['application/ld+json', fixture('pat-graph.jsonld')],
    };
    const file = files[url.pathname];
    if (!file) return route.fulfill({ status: 404, headers, body: '' });
    return route.fulfill({ status: 200, headers, contentType: file[0], body: file[1] });
  });
}

export async function openNodePage(
  session: Session,
  origin: string,
): Promise<{ page: Page; tabId: number }> {
  return openPage(session, origin, '/node', 'node page');
}

/** Presses the chip in the panel of `tabId` and returns the explorer tab it opens. */
export async function openExplorer(session: Session, tabId: number): Promise<Page> {
  const panel = await openPanelFor(session, tabId);
  await expect(panel.locator('#open-graph')).toBeVisible();
  const opened = session.context.waitForEvent('page');
  await panel.click('#open-graph');
  const explorer = await opened;
  await explorer.waitForLoadState('domcontentloaded');
  return explorer;
}

/** The site's explorer marks its root with data-state: loading, ready or error. */
export const explorerState = (page: Page, expected: string) =>
  expect(page.locator('.gx[data-state]')).toHaveAttribute('data-state', expected, {
    timeout: 20_000,
  });

/** Also publishes graph.nq and the vocabulary file recorded from the live main node. The digests the
 *  linkset declares for both are those of the recorded files (fixtures/graph/README.md). */
export function serveQueryFiles(session: Session, files: { graphNq?: string } = {}): void {
  const { routes } = session.site;
  routes.set('/graph.nq', {
    type: 'application/n-quads; charset=utf-8',
    body: files.graphNq ?? fixture('asc-graph.nq'),
  });
  routes.set('/ns/agsc.ttl', {
    type: 'text/turtle; charset=utf-8',
    body: fixture('asc-ontology.ttl'),
  });
}
