// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The endpoint API key never enters the activity log: not when a service echoes it in an error,
// not when the model puts it in a tool call, with "include content" on or off.
import { beforeEach, describe, expect, it } from 'vitest';
import { EndpointRuntime, type FetchLike } from '../../src/adapters/endpoint-runtime';
import { InMemoryActivity } from '../../src/fakes/in-memory-activity';
import { startPanel } from '../../src/ui/panel-controller';
import { call } from '../helpers';
import { byId, click, loadPage, tick } from '../ui/dom';
import { fakeDeps, ORIGIN, type FakeDeps } from '../ui/panel-fakes';

const KEY = 'sk-or-v1-secret-0123456789abcdef';
const URL = 'https://openrouter.ai/api/v1';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

function panelWith(
  replies: string[],
  fetchFn?: FetchLike,
): { deps: FakeDeps; log: InMemoryActivity } {
  const deps = fakeDeps(replies);
  const log = new InMemoryActivity();
  (deps as { activity?: InMemoryActivity }).activity = log;
  const endpoint = { ...deps.settings.endpoint, url: URL, model: 'vendor/small', apiKey: KEY };
  deps.settings = {
    ...deps.settings,
    runtime: fetchFn ? 'endpoint' : deps.settings.runtime,
    confirmMode: 'per-site',
    endpoint,
  };
  deps.panelState = { firstRunDone: true, endpointHosts: ['openrouter.ai'] };
  deps.grants.origins.add(ORIGIN);
  if (fetchFn) {
    deps.createRuntime = () =>
      Promise.resolve({ runtime: new EndpointRuntime(deps.settings.endpoint, fetchFn) });
  }
  return { deps, log };
}

async function ask(deps: FakeDeps): Promise<void> {
  await startPanel(deps);
  click('start');
  await settle();
  byId<HTMLTextAreaElement>('question').value = `What is here? ${KEY}`;
  byId<HTMLFormElement>('ask').requestSubmit();
  await settle();
}

const echoes =
  (chat: () => Promise<Response>): FetchLike =>
  (url) =>
    url.endsWith('/models') ? Promise.resolve(new Response('{"data":[]}')) : chat();

describe('the endpoint API key and the activity log', () => {
  beforeEach(() => loadPage('sidepanel.html'));

  for (const content of [false, true]) {
    it(`a service that echoes the key in an error: not in the log (include content ${content})`, async () => {
      const fetchFn = echoes(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: `bad Bearer ${KEY}` } }), {
            status: 401,
          }),
        ),
      );
      const { deps, log } = panelWith([], fetchFn);
      log.content = content;
      await ask(deps);
      expect(log.records).toHaveLength(1);
      expect(log.records[0]?.outcome).toBe('error');
      expect(JSON.stringify(log.records)).not.toContain(KEY);
    });

    it(`a model that puts the key in a tool call and the question: not in the log (include content ${content})`, async () => {
      const { deps, log } = panelWith([call('search', { query: KEY }), '{"answer":"ok"}']);
      log.content = content;
      await ask(deps);
      expect(log.records[0]?.tools).toHaveLength(1);
      expect(JSON.stringify(log.records)).not.toContain(KEY);
    });
  }
});
