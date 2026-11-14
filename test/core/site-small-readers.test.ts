// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAgentCard, parseSecurityTxt, tdmReserved } from '../../src/core/site-small';
import { decideAiInput, parseRobots } from '../../src/core/site-robots';
import { pageFact, type PageMeta } from '../../src/core/site-page';
import type { FileOutcome } from '../../src/core/site-files';

const fixture = (name: string): string => readFileSync(`fixtures/site-files/${name}`, 'utf8');
const NODE = 'https://agenticsystemcore.com';
const NOW = Date.parse('2026-11-14T00:00:00Z');

describe('small files', () => {
  it('reads an agent card down to a name, a description, a version and skill names', () => {
    const raw = JSON.stringify({
      name: 'Helper',
      description: 'Does things',
      version: '1.0',
      securitySchemes: { key: 'secret' },
      supportedInterfaces: [{ url: 'https://x.test/rpc' }],
      skills: [{ name: 'one' }, { name: 'two' }, { id: 'no-name' }, 7],
    });
    expect(parseAgentCard(raw)).toEqual({
      name: 'Helper',
      description: 'Does things',
      version: '1.0',
      skills: ['one', 'two'],
    });
    expect(parseAgentCard('{"description":"x"}')).toBeUndefined();
    expect(parseAgentCard('[]')).toBeUndefined();
    expect(parseAgentCard('nope')).toBeUndefined();
  });

  it('caps the skill names at ten of sixty characters', () => {
    const skills = Array.from({ length: 30 }, () => ({ name: 'n'.repeat(100) }));
    const card = parseAgentCard(JSON.stringify({ name: 'A', skills }));
    expect(card?.skills).toHaveLength(10);
    expect(card?.skills[0]).toHaveLength(60);
  });

  it('reads security.txt from the live node', () => {
    const security = parseSecurityTxt(fixture('agsc-security.txt'), NODE, NOW);
    expect(security?.contacts).toHaveLength(2);
    expect(security?.policy).toMatch(/SECURITY\.md$/);
    expect(security?.expired).toBe(false);
    expect(security?.expires).toBe('2027-11-12T09:14:46.000Z');
  });

  it('marks an expired security.txt, and ignores one that names another site as canonical', () => {
    const old = 'Contact: mailto:a@x.test\nExpires: 2020-01-01T00:00:00Z\n';
    expect(parseSecurityTxt(old, NODE, NOW)?.expired).toBe(true);
    const other = 'Contact: a\nCanonical: https://elsewhere.test/.well-known/security.txt\n';
    expect(parseSecurityTxt(other, NODE, NOW)).toBeUndefined();
    expect(parseSecurityTxt('Expires: 2030-01-01T00:00:00Z', NODE, NOW)).toBeUndefined();
    expect(parseSecurityTxt('Contact: a\nExpires: soon', NODE, NOW)).toEqual({ contacts: ['a'] });
  });

  it('stops at a PGP signature and at the line limit', () => {
    const signed = 'Contact: a\n-----BEGIN PGP SIGNATURE-----\nContact: forged\n';
    expect(parseSecurityTxt(signed, NODE, NOW)?.contacts).toEqual(['a']);
    const long = `${'# c\n'.repeat(1000)}Contact: late\n`;
    expect(parseSecurityTxt(long, NODE, NOW)).toBeUndefined();
  });

  it('reads a TDMRep reservation for a path', () => {
    expect(tdmReserved(fixture('agsc-tdmrep.json'), '/anything')).toBe(true);
    expect(
      tdmReserved(
        '[{"location":"/blog","tdm-reservation":0},{"location":"/","tdm-reservation":1}]',
        '/blog/a',
      ),
    ).toBe(false);
    expect(tdmReserved('[{"location":"/","tdm-reservation":7}]', '/')).toBeUndefined();
    expect(tdmReserved('{}', '/')).toBeUndefined();
    expect(tdmReserved('nope', '/')).toBeUndefined();
  });
});

const found = (text: string): FileOutcome => ({
  state: 'found',
  text,
  cut: false,
  link: '',
  contentType: 'text/plain',
});

describe('robots.txt and the signal rules', () => {
  it('reads the last Content-Signal of the "*" group, not of named crawlers', () => {
    const robots =
      'User-agent: GPTBot\nContent-Signal: ai-input=no\n\nUser-agent: *\nContent-Signal: ai-input=yes, ai-train=no\n';
    expect(parseRobots(robots)).toEqual({ aiInput: true, aiTrain: false });
    expect(parseRobots(fixture('agsc-robots.txt'))).toEqual({
      search: true,
      aiInput: true,
      aiTrain: false,
    });
  });

  it('lets two User-agent lines share one group', () => {
    const robots = 'User-agent: Bot\nUser-agent: *\nContent-Signal: ai-input=no\n';
    expect(parseRobots(robots).aiInput).toBe(false);
  });

  it('ignores a signal outside the "*" group and values it cannot read', () => {
    expect(parseRobots('Content-Signal: ai-input=no\n')).toEqual({});
    expect(parseRobots('User-agent: *\nContent-Signal: ai-input=maybe, junk\n')).toEqual({});
  });

  it.each([
    ['Content-Signal: ai-input=yes', 'allowed'],
    ['Content-Signal: ai-input=no', 'blocked'],
    ['Content-Signal: ai-train=no', 'not-stated'],
    ['Disallow: /private', 'not-stated'],
  ])('treats "%s" as %s', (line, treated) => {
    expect(decideAiInput(found(`User-agent: *\n${line}\n`))).toBe(treated);
  });

  it('treats a file that cannot be read as "unreadable", a missing or refused one as "not stated"', () => {
    expect(decideAiInput({ state: 'unavailable', why: 'server' })).toBe('unreadable');
    expect(decideAiInput({ state: 'unavailable', why: 'timeout' })).toBe('unreadable');
    expect(decideAiInput({ state: 'not-usable', why: 'size' })).toBe('unreadable');
    expect(decideAiInput({ state: 'unavailable', why: 'denied' })).toBe('not-stated');
    expect(decideAiInput({ state: 'not-published' })).toBe('not-stated');
    expect(decideAiInput({ state: 'not-usable', why: 'type' })).toBe('not-stated');
    expect(decideAiInput(undefined)).toBe('not-stated');
  });
});

describe('page data', () => {
  const meta = (change: Partial<PageMeta> = {}): PageMeta => ({
    title: 'T',
    og: {},
    jsonLd: [],
    links: [],
    ...change,
  });

  it('prefers JSON-LD, then Open Graph, then the description meta tag', () => {
    const ld = JSON.stringify({
      '@type': 'Article',
      headline: 'H',
      dateModified: '2026-01-01',
      license: 'https://x.test/l',
      inLanguage: 'en',
    });
    expect(pageFact(meta({ jsonLd: [ld], og: { title: 'O' } }))).toMatchObject({
      source: 'JSON-LD',
      type: 'Article',
      title: 'H',
      date: '2026-01-01',
      license: 'https://x.test/l',
      language: 'en',
    });
    expect(pageFact(meta({ og: { title: 'O', type: 'website' } }))).toMatchObject({
      source: 'Open Graph',
      title: 'O',
      type: 'website',
    });
    expect(pageFact(meta({ description: 'D' }))).toMatchObject({
      source: 'meta',
      description: 'D',
    });
    expect(pageFact(meta())).toBeUndefined();
  });

  it('walks @graph one level and skips a block that is not JSON', () => {
    const graph = JSON.stringify({
      '@graph': [{ '@type': 'WebSite' }, { '@type': ['WebPage', 'X'], name: 'N' }],
    });
    expect(pageFact(meta({ jsonLd: ['not json', graph] }))).toMatchObject({
      type: 'WebPage',
      title: 'N',
    });
  });

  it('keeps only a few text members and cuts them', () => {
    const ld = JSON.stringify({
      '@type': 'Thing',
      name: 'x'.repeat(1000),
      potentialAction: { target: 'https://evil.test' },
      '@id': 'https://evil.test/id',
    });
    const fact = pageFact(meta({ jsonLd: [ld] }));
    expect(fact?.title).toHaveLength(300);
    expect(Object.keys(fact ?? {})).not.toContain('potentialAction');
    expect(JSON.stringify(fact)).not.toContain('evil.test');
  });
});
