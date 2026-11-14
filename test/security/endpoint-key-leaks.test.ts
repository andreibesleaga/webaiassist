// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The endpoint API key stays in the Options record. A service that echoes it back (in an error
// body, an error inside the stream, or a failed connection) must not put it on the screen, in
// the transcript, in the export, in the saved chat, in the panel's own record or in a log.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndpointRuntime, type FetchLike } from '../../src/adapters/endpoint-runtime';
import { startPanel } from '../../src/ui/panel-controller';
import { byId, click, loadPage, tick } from '../ui/dom';
import { fakeDeps, ORIGIN, type FakeDeps } from '../ui/panel-fakes';

const KEY = 'sk-or-v1-secret-0123456789abcdef';
const URL = 'https://openrouter.ai/api/v1';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

/** A service that accepts the connection check and then fails each chat the given way. */
function hostile(chat: () => Promise<Response>): FetchLike {
  return (url) => (url.endsWith('/models') ? Promise.resolve(new Response('{"data":[]}')) : chat());
}

function panelWith(fetchFn: FetchLike): FakeDeps {
  const deps = fakeDeps([]);
  const endpoint = { ...deps.settings.endpoint, url: URL, model: 'vendor/small', apiKey: KEY };
  deps.settings = { ...deps.settings, runtime: 'endpoint', endpoint };
  deps.panelState = { firstRunDone: true, endpointHosts: ['openrouter.ai'] };
  deps.grants.origins.add(ORIGIN);
  deps.createRuntime = () =>
    Promise.resolve({ runtime: new EndpointRuntime(deps.settings.endpoint, fetchFn) });
  return deps;
}

async function askAndExport(deps: FakeDeps): Promise<string> {
  await startPanel(deps);
  click('start');
  await settle();
  byId<HTMLTextAreaElement>('question').value = 'What is here?';
  byId<HTMLFormElement>('ask').requestSubmit();
  await settle();
  click('export');
  return [
    document.body.textContent ?? '',
    deps.downloads.map((d) => d.text).join('\n'),
    JSON.stringify(await deps.memoryStore.loadChat(ORIGIN)),
    JSON.stringify(deps.panelState),
  ].join('\n');
}

const failures: [string, () => Promise<Response>][] = [
  [
    'an error body that echoes the header',
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: `bad Authorization: Bearer ${KEY}` } }), {
          status: 401,
        }),
      ),
  ],
  ['a failed connection that echoes the header', () => Promise.reject(new TypeError(`x ${KEY}`))],
  [
    'an error event inside the stream',
    () =>
      Promise.resolve(
        new Response(`data: ${JSON.stringify({ error: { message: `key=${KEY}` } })}\n\n`),
      ),
  ],
];

describe('the endpoint API key and a service that echoes it', () => {
  const logs: unknown[][] = [];
  beforeEach(() => {
    loadPage('sidepanel.html');
    logs.length = 0;
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args));
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(failures)(
    'keeps it out of the panel, export, saved chat and logs: %s',
    async (_n, chat) => {
      const everything = await askAndExport(panelWith(hostile(chat)));
      expect(everything).not.toContain(KEY);
      expect(JSON.stringify(logs)).not.toContain(KEY);
      expect(everything).toMatch(/endpoint|reach|answered/i);
    },
  );
});
