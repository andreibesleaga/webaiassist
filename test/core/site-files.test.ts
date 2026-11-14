// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  checkReply,
  LIMITS,
  mediaType,
  SITE_FILES,
  specOf,
  type SiteFileReply,
} from '../../src/core/site-files';

const reply = (change: Partial<SiteFileReply> = {}): SiteFileReply => ({
  status: 200,
  contentType: 'text/plain; charset=utf-8',
  link: '',
  text: '# Title',
  cut: false,
  ...change,
});

describe('the fixed list of site files', () => {
  it('has at most nine files, each path once, every path from the site root', () => {
    expect(SITE_FILES.length).toBeLessThanOrEqual(LIMITS.maxFiles);
    // The cap was eight; the ninth is the sustainability file, approved on 14 Nov 2026. The two
    // kept ones stay in the list.
    expect(LIMITS.maxFiles).toBe(9);
    const ids = SITE_FILES.map((file) => file.id);
    expect(ids).toEqual(expect.arrayContaining(['api-catalog', 'agent-card', 'sustainability']));
    const paths = SITE_FILES.map((file) => file.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/[A-Za-z0-9._/-]+$/);
  });

  it('holds the stated time limits', () => {
    expect(LIMITS.fileMs).toBe(5000);
    expect(LIMITS.totalMs).toBe(10_000);
  });

  it('finds a file by id and fails loudly for an unknown one', () => {
    expect(specOf('llms').path).toBe('/llms.txt');
    expect(() => specOf('nothing' as never)).toThrow(/unknown/);
  });
});

describe('checkReply', () => {
  const llms = specOf('llms');
  const linkset = specOf('linkset');

  it('keeps the sustainability file small and fixed, as JSON', () => {
    const spec = specOf('sustainability');
    expect(spec).toMatchObject({
      path: '/.well-known/sustainability-data',
      maxBytes: 8192,
      json: true,
    });
    expect(spec.accept).toContain('application/sustainability-data+json');
  });

  it('accepts status 200 with an expected type', () => {
    expect(checkReply(llms, reply())).toMatchObject({
      state: 'found',
      text: '# Title',
      cut: false,
    });
  });

  it('says "not published" for 404 and 410', () => {
    expect(checkReply(llms, reply({ status: 404 }))).toEqual({ state: 'not-published' });
    expect(checkReply(llms, reply({ status: 410 }))).toEqual({ state: 'not-published' });
  });

  it('says "unavailable" for 401, 403, 5xx, other statuses, timeouts and network errors', () => {
    expect(checkReply(llms, reply({ status: 403 }))).toEqual({
      state: 'unavailable',
      why: 'denied',
    });
    expect(checkReply(llms, reply({ status: 401 }))).toEqual({
      state: 'unavailable',
      why: 'denied',
    });
    expect(checkReply(llms, reply({ status: 503 }))).toEqual({
      state: 'unavailable',
      why: 'server',
    });
    expect(checkReply(llms, reply({ status: 204 }))).toEqual({
      state: 'unavailable',
      why: 'network',
    });
    expect(checkReply(llms, reply({ failed: 'timeout' }))).toEqual({
      state: 'unavailable',
      why: 'timeout',
    });
    expect(checkReply(llms, reply({ failed: 'network' }))).toEqual({
      state: 'unavailable',
      why: 'network',
    });
  });

  it('refuses an HTML page that answers 200 for a data file (soft 404)', () => {
    const page = reply({ contentType: 'text/html; charset=utf-8', text: '<html>' });
    expect(checkReply(llms, page)).toEqual({ state: 'not-usable', why: 'type' });
    expect(checkReply(linkset, page)).toEqual({ state: 'not-usable', why: 'type' });
  });

  it('compares the media type without parameters and in lower case', () => {
    expect(mediaType('Application/Linkset+JSON; profile="x"')).toBe('application/linkset+json');
    const json = reply({ contentType: 'Application/Linkset+JSON; profile="x"', text: '{}' });
    expect(checkReply(linkset, json).state).toBe('found');
  });

  it('drops a JSON file that was cut and keeps the first part of a text file that was cut', () => {
    expect(checkReply(linkset, reply({ contentType: 'application/json', cut: true }))).toEqual({
      state: 'not-usable',
      why: 'size',
    });
    expect(checkReply(llms, reply({ cut: true }))).toMatchObject({ state: 'found', cut: true });
  });

  it('never keeps more than the file cap, whatever the page script sent', () => {
    const big = reply({ text: 'x'.repeat(llms.maxBytes + 100) });
    const outcome = checkReply(llms, big);
    expect(outcome.state === 'found' && outcome.text.length).toBe(llms.maxBytes);
  });
});
