// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { isAllowedPeerOrigin, peerChoices } from '../../src/adapters/peers';
import type { LinksetLink } from '../../src/core/site-linkset';

describe('isAllowedPeerOrigin', () => {
  const allowed: [string, string][] = [
    ['https://patterns.agenticsystemcore.com', 'https://patterns.agenticsystemcore.com'],
    ['https://Peer.Example./x', 'https://peer.example'],
    ['https://peer.example:443/', 'https://peer.example'],
    ['https://xn--bcher-kva.example/', 'https://xn--bcher-kva.example'],
  ];
  it.each(allowed)('allows %s', (input, origin) => {
    expect(isAllowedPeerOrigin(input)).toEqual({ ok: true, origin });
  });

  const refused: [string, string][] = [
    ['http://peer.example/', 'not-https'],
    ['https://1.2.3.4/', 'ip'],
    ['https://[::1]/', 'ip'],
    ['https://2130706433/', 'ip'],
    ['https://localhost/', 'local'],
    ['https://app.localhost/', 'local'],
    ['https://printer.local/', 'local'],
    ['https://db.internal/', 'local'],
    ['https://intranet/', 'no-dot'],
    ['https://peer.example:8443/', 'port'],
    ['https://user:pw@peer.example/', 'user-info'],
    ['ftp://peer.example/', 'not-https'],
    ['not a url', 'invalid'],
  ];
  it.each(refused)('refuses %s (%s)', (input, why) => {
    expect(isAllowedPeerOrigin(input)).toEqual({ ok: false, why });
  });
});

const link = (href: string, rel = 'peer'): LinksetLink => ({
  rel,
  href,
  sameOrigin: false,
});

describe('peerChoices', () => {
  const TAB = 'https://agenticsystemcore.com';

  it('lists the peer links with the reason for each that cannot be ticked', () => {
    const choices = peerChoices(
      [
        link('https://patterns.agenticsystemcore.com/.well-known/knowledge-linkset'),
        link('http://127.0.0.2/.well-known/knowledge-linkset'),
        link('https://1.2.3.4/.well-known/knowledge-linkset'),
        link('https://other.example/', 'alternate'),
      ],
      TAB,
    );
    expect(choices).toEqual([
      { origin: 'https://patterns.agenticsystemcore.com', allowed: true },
      { origin: 'http://127.0.0.2', allowed: false, why: 'not-https' },
      { origin: 'https://1.2.3.4', allowed: false, why: 'ip' },
    ]);
  });

  it('drops duplicates and the tab’s own origin, and keeps at most 16', () => {
    const many = Array.from({ length: 20 }, (_, index) => link(`https://p${index}.example/x`));
    const choices = peerChoices(
      [link(`${TAB}/.well-known/knowledge-linkset`), link('https://P0.example./y'), ...many],
      TAB,
    );
    expect(choices).toHaveLength(16);
    expect(new Set(choices.map((choice) => choice.origin)).size).toBe(16);
    expect(choices.some((choice) => choice.origin === TAB)).toBe(false);
  });
});
