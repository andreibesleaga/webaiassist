// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026: the model port and the compat-mode permission
// flow. A failing test here is an open finding of the review (see the report).
import { describe, expect, it } from 'vitest';
import { enableCompat, type CompatScript } from '../../src/adapters/compat-mode';
import { serveModelHost } from '../../src/adapters/model-host';
import { PortModelRuntime } from '../../src/adapters/port-model-runtime';
import type { ChatMessage } from '../../src/core/types';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { portPair } from '../adapters/port-pair';

const later = (ms: number): Promise<'no answer'> =>
  new Promise((resolve) => setTimeout(() => resolve('no answer'), ms));

describe('finding: the model host drops a request it cannot accept without a reply', () => {
  it('a chat with more messages than the host takes ends with an error, not a hang', async () => {
    const [panelSide, hostSide] = portPair();
    serveModelHost(hostSide, new FakeModelRuntime(['{"answer":"ok"}']));
    const runtime = new PortModelRuntime(
      () => panelSide,
      () => 'c1',
    );
    const messages: ChatMessage[] = Array.from({ length: 501 }, () => ({
      role: 'user',
      content: 'turn',
    }));
    const outcome = await Promise.race([
      runtime.chat({ messages }).then(
        () => 'answered',
        () => 'error',
      ),
      later(200),
    ]);
    expect(outcome).toBe('error');
  });
});

describe('held: compat mode cannot be turned on without the user’s grant', () => {
  function deps(granted: boolean) {
    const registered: CompatScript[] = [];
    const reloaded: number[] = [];
    return {
      registered,
      reloaded,
      request: () => Promise.resolve(granted),
      register: (script: CompatScript) => {
        registered.push(script);
        return Promise.resolve();
      },
      isRegistered: () => Promise.resolve(false),
      reload: (tabId: number) => {
        reloaded.push(tabId);
        return Promise.resolve();
      },
    };
  }

  it('registers nothing when the browser prompt is refused', async () => {
    const d = deps(false);
    expect(await enableCompat(d, { tabId: 1, origin: 'https://a.example' })).toBe('denied');
    expect(d.registered).toEqual([]);
    expect(d.reloaded).toEqual([]);
  });

  it('registers one origin, top frame only, not kept across restarts', async () => {
    const d = deps(true);
    await enableCompat(d, { tabId: 1, origin: 'https://a.example' });
    expect(d.registered).toEqual([
      expect.objectContaining({
        matches: ['https://a.example/*'],
        world: 'MAIN',
        persistAcrossSessions: false,
      }),
    ]);
    expect(d.registered[0]).not.toHaveProperty('allFrames');
  });

  it.each(['chrome://settings', 'file:///tmp', 'https://a.example/path'])(
    'refuses the origin %s',
    async (origin) => {
      const d = deps(true);
      await expect(enableCompat(d, { tabId: 1, origin })).rejects.toThrow();
      expect(d.registered).toEqual([]);
    },
  );

  it('finding: refuses a wildcard host, which would ask for every subdomain', async () => {
    const d = deps(true);
    await expect(enableCompat(d, { tabId: 1, origin: 'https://*.example' })).rejects.toThrow();
    expect(d.registered).toEqual([]);
  });
});
