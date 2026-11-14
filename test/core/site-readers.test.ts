// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLlms } from '../../src/core/site-llms';
import { AGSC_PROFILE, namesProfile, parseLinkset } from '../../src/core/site-linkset';
import { parseAddress, resolveAddress } from '../../src/core/site-url';

const fixture = (name: string): string => readFileSync(`fixtures/site-files/${name}`, 'utf8');
const NODE = 'https://agenticsystemcore.com';

describe('parseLlms (the live node file)', () => {
  const llms = parseLlms(fixture('agsc-llms.txt'));

  it('reads the title, the summary and the provenance comment', () => {
    expect(llms?.title).toBe('AgenticSystemCore');
    expect(llms?.summary).toMatch(/^An open specification/);
    expect(llms?.provenance.spec_version).toBe('1.1.0');
    expect(llms?.provenance.license).toBe('LicenseRef-AgenticSystemCore-Content-Use-1.0');
  });

  it('reads sections and links', () => {
    expect(llms?.sections.map((s) => s.name)).toEqual(['Guides', 'Project board', 'Vocabulary']);
    expect(llms?.linkCount).toBe(14);
    expect(llms?.sections[0]?.links[0]).toMatchObject({
      text: 'Publish a Level-0 node',
      url: 'https://agenticsystemcore.com/procedures/publish-a-level-0-node/',
    });
  });

  it('is not usable without a title line', () => {
    expect(parseLlms('> only a summary\n## S\n- [a](https://x.test/)')).toBeUndefined();
    expect(parseLlms('')).toBeUndefined();
  });

  it('keeps a link that is not https as text without an address', () => {
    const parsed = parseLlms(
      '# T\n## S\n- [a](javascript:void0): note\n- [b](http://x.test/)\n- [c](https://x.test/c)',
    );
    const links = parsed?.sections[0]?.links;
    expect(links?.map((l) => l.url)).toEqual([undefined, undefined, 'https://x.test/c']);
    expect(links?.[0]?.note).toBe('note');
  });

  it('ignores provenance keys it does not know and other comments', () => {
    const text = '# T\n<!-- agsc:provenance\nevil: x\nbundle: b\n-->\n<!-- other -->\n';
    expect(parseLlms(text)?.provenance).toEqual({ bundle: 'b' });
  });

  it('stops at its caps for sections and links', () => {
    const many = [
      '# T',
      ...Array.from({ length: 60 }, (_, i) => `## S${i}\n- [a](https://x.test/${i})`),
    ];
    const parsed = parseLlms(many.join('\n'));
    expect(parsed?.sections).toHaveLength(40);
    const links = [
      '# T',
      '## S',
      ...Array.from({ length: 500 }, (_, i) => `- [a](https://x.test/${i})`),
    ];
    expect(parseLlms(links.join('\n'))?.linkCount).toBe(400);
  });
});

describe('addresses', () => {
  it('compares origins as a browser writes them', () => {
    expect(parseAddress('HTTPS://Example.COM:443/a?b#c')).toEqual({
      origin: 'https://example.com',
      href: 'https://example.com/a?b',
    });
    expect(parseAddress('http://127.0.0.1:8080/x')?.origin).toBe('http://127.0.0.1:8080');
    expect(parseAddress('javascript:alert(1)')).toBeUndefined();
    expect(parseAddress('ftp://x.test/')).toBeUndefined();
  });

  it('resolves only absolute addresses and paths from the root', () => {
    expect(resolveAddress('/a', 'https://x.test')?.href).toBe('https://x.test/a');
    expect(resolveAddress('//evil.test/a', 'https://x.test')).toBeUndefined();
    expect(resolveAddress('a/b', 'https://x.test')).toBeUndefined();
  });
});

describe('parseLinkset (the live node file)', () => {
  const type = `application/linkset+json; profile="${AGSC_PROFILE}"`;

  it('accepts the profile from the media type or from the Link header', () => {
    expect(namesProfile(AGSC_PROFILE, type, '')).toBe(true);
    expect(
      namesProfile(AGSC_PROFILE, 'application/linkset+json', `<${AGSC_PROFILE}>; rel="profile"`),
    ).toBe(true);
    expect(namesProfile(AGSC_PROFILE, 'application/linkset+json', '')).toBe(false);
    expect(
      namesProfile(AGSC_PROFILE, 'application/linkset+json', `<${AGSC_PROFILE}>; rel="other"`),
    ).toBe(false);
  });

  it('reads the anchor, the versions and the links, with the node prefix cut', () => {
    const result = parseLinkset(fixture('agsc-linkset.json'), NODE, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { linkset } = result;
    expect(linkset.specVersion).toBe('1.1.0');
    expect(linkset.bundleVersion).toMatch(/^v1\.1\.0/);
    expect(linkset.restricted).toBe(false);
    const rels = new Set(linkset.links.map((l) => l.rel));
    expect(rels).toContain('skills');
    expect(rels).toContain('surface');
    expect(rels).toContain('alternate');
    expect(linkset.links.find((l) => l.surface === 'webmcp')?.href).toBe(
      'https://agenticsystemcore.com/compose/',
    );
  });

  it('marks links to other hosts, so they are shown as text and never followed', () => {
    const result = parseLinkset(fixture('agsc-linkset.json'), NODE, true);
    if (!result.ok) throw new Error('not ok');
    const peer = result.linkset.links.find((l) => l.rel === 'peer');
    expect(peer?.sameOrigin).toBe(false);
    expect(result.linkset.links.filter((l) => l.sameOrigin).length).toBeGreaterThan(10);
  });

  it('refuses a document whose anchor is another site (AGSC-06-08)', () => {
    const other = fixture('agsc-linkset.json').replace(
      '"anchor":"https://agenticsystemcore.com/"',
      '"anchor":"https://elsewhere.test/"',
    );
    expect(parseLinkset(other, NODE, true)).toEqual({ ok: false, why: 'anchor' });
  });

  it.each([
    ['not json', 'nope'],
    ['an array', '[]'],
    [
      'a second top-level member',
      '{"linkset":[{"anchor":"https://agenticsystemcore.com/"}],"x":1}',
    ],
    ['two contexts', '{"linkset":[{"anchor":"https://agenticsystemcore.com/"},{}]}'],
    ['no anchor', '{"linkset":[{}]}'],
  ])('refuses %s', (_name, text) => {
    expect(parseLinkset(text, NODE, true)).toEqual({ ok: false, why: 'parse' });
  });

  it('reads the restricted and tombstone attributes of the anchor link', () => {
    const doc = (extra: string) =>
      `{"linkset":[{"anchor":"${NODE}/","describedby":[{"href":"${NODE}/graph.jsonld",${extra}}]}]}`;
    const restricted = parseLinkset(doc('"agsc-visibility":["restricted"]'), NODE, true);
    const gone = parseLinkset(doc('"agsc-tombstone":["2026-11-01T00:00:00Z"]'), NODE, true);
    expect(restricted.ok && restricted.linkset.restricted).toBe(true);
    expect(gone.ok && gone.linkset.tombstone).toBe(true);
  });

  it('skips links without an address and links with a script address', () => {
    const doc = `{"linkset":[{"anchor":"${NODE}/","item":[{"href":"javascript:x"},{"title":"t"},{"href":"/ok"}]}]}`;
    const result = parseLinkset(doc, NODE, false);
    expect(result.ok && result.linkset.links.map((l) => l.href)).toEqual([`${NODE}/ok`]);
  });
});
