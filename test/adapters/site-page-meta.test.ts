// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { readPageMeta } from '../../src/adapters/site-page-scripts';
import { parseMessage } from '../../src/protocol/validate';

function page(head: string): void {
  document.head.innerHTML = head;
  document.documentElement.lang = 'en';
}

beforeEach(() => {
  document.title = '';
});

describe('readPageMeta (the function that runs in the tab)', () => {
  it('reads JSON-LD, Open Graph, meta and the links of the known kinds, as a valid site/page', () => {
    page(`
      <title>Home</title>
      <meta name="description" content="About">
      <meta name="tdm-reservation" content="1">
      <meta property="og:title" content="OG">
      <meta property="og:site_name" content="Site">
      <link rel="describedby" href="/.well-known/knowledge-linkset" type="application/linkset+json">
      <link rel="stylesheet" href="/x.css">
      <link rel="alternate" href="/index.md" type="text/markdown">
      <script type="application/ld+json">{"@type":"WebSite","name":"S"}</script>
      <script>var x = 1;</script>`);
    document.title = 'Home';
    const meta = readPageMeta();
    expect(parseMessage(meta, 'site').ok).toBe(true);
    expect(meta).toMatchObject({
      type: 'site/page',
      title: 'Home',
      language: 'en',
      description: 'About',
      tdm: '1',
      og: { title: 'OG', siteName: 'Site' },
      jsonLd: ['{"@type":"WebSite","name":"S"}'],
    });
    const links = (meta as { links: { rel: string; href: string }[] }).links;
    expect(links.map((link) => link.rel)).toEqual(['describedby', 'alternate']);
    expect(links[0]?.href).toMatch(/\/\.well-known\/knowledge-linkset$/);
  });

  it('reads at most five JSON-LD blocks and cuts each one', () => {
    const block = (text: string) => `<script type="application/ld+json">${text}</script>`;
    page(Array.from({ length: 8 }, () => block('x'.repeat(40000))).join(''));
    const meta = readPageMeta() as { jsonLd: string[] };
    expect(meta.jsonLd).toHaveLength(5);
    expect(meta.jsonLd[0]).toHaveLength(32768);
  });

  it('leaves out a reservation value that is not 0 or 1', () => {
    page('<meta name="tdm-reservation" content="maybe">');
    expect(readPageMeta()).not.toHaveProperty('tdm');
  });
});
