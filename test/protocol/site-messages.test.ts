// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { SITE_FILES } from '../../src/core/site-files';
import type { Message } from '../../src/protocol/messages';
import { HOPS } from '../../src/protocol/messages';
import { MESSAGE_SCHEMAS } from '../../src/protocol/schemas';
import { parseMessage } from '../../src/protocol/validate';

const file = {
  type: 'site/file',
  id: 'llms',
  origin: 'https://node.example',
  status: 200,
  contentType: 'text/plain',
  link: '',
  text: '# Title',
  cut: false,
};
const page = {
  type: 'site/page',
  origin: 'https://node.example',
  title: 'T',
  og: { title: 'O' },
  jsonLd: ['{}'],
  links: [{ rel: 'describedby', href: '/x', type: 'text/plain' }],
};

describe('the site messages', () => {
  it('are carried on the site hop only', () => {
    expect([...HOPS.site]).toEqual(['site/file', 'site/page', 'site/graph-file']);
    for (const hop of ['page', 'content', 'panel', 'offscreen'] as const) {
      expect(parseMessage(file, hop).ok).toBe(false);
      expect(parseMessage(page, hop).ok).toBe(false);
    }
  });

  it('accept a valid file answer and a valid page reading', () => {
    expect(parseMessage(file, 'site')).toEqual({ ok: true, value: file as Message });
    expect(parseMessage(page, 'site').ok).toBe(true);
    expect(parseMessage({ ...file, failed: 'timeout', status: 0 }, 'site').ok).toBe(true);
  });

  it('refuse an extra field, an oversize text and a "__proto__" key', () => {
    expect(parseMessage({ ...file, extra: 1 }, 'site').ok).toBe(false);
    expect(parseMessage({ ...file, text: 'x'.repeat(512001) }, 'site').ok).toBe(false);
    const proto: unknown = JSON.parse(
      `{"type":"site/file","id":"llms","origin":"https://a.test","status":200,"contentType":"","link":"","text":"","cut":false,"__proto__":{"x":1}}`,
    );
    expect(parseMessage(proto, 'site').ok).toBe(false);
    const og: unknown = JSON.parse('{"__proto__":"x"}');
    expect(parseMessage({ ...page, og }, 'site').ok).toBe(false);
  });

  it('refuse an id outside the fixed list, an off-pattern origin and a bad status', () => {
    expect(parseMessage({ ...file, id: '../etc/passwd' }, 'site').ok).toBe(false);
    expect(parseMessage({ ...file, origin: 'javascript:1' }, 'site').ok).toBe(false);
    expect(parseMessage({ ...file, status: 700 }, 'site').ok).toBe(false);
    expect(parseMessage({ ...file, cut: 'no' }, 'site').ok).toBe(false);
  });

  it('refuse more JSON-LD blocks, links and block text than the page script reads', () => {
    expect(parseMessage({ ...page, jsonLd: Array(6).fill('{}') }, 'site').ok).toBe(false);
    expect(parseMessage({ ...page, jsonLd: ['x'.repeat(32769)] }, 'site').ok).toBe(false);
    const links = Array.from({ length: 61 }, () => ({ rel: 'alternate', href: '/x' }));
    expect(parseMessage({ ...page, links }, 'site').ok).toBe(false);
  });

  it('name the same ids as the fixed list of files', () => {
    const schema = MESSAGE_SCHEMAS['site/file'] as { properties: { id: { enum: string[] } } };
    expect([...schema.properties.id.enum].sort()).toEqual(SITE_FILES.map((spec) => spec.id).sort());
  });
});
