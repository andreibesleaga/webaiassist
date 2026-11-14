// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The one-time question before a remote chat endpoint is used (once per host), the model-list
// entry that leads to the endpoint set-up, and the OpenRouter preset in Options.
import { beforeEach, describe, expect, it } from 'vitest';
import { ENDPOINT_PRESETS, type Settings } from '../../src/adapters/settings';
import { startOptions } from '../../src/ui/options-page';
import { startPanel } from '../../src/ui/panel-controller';
import type { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { answer } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { choose, fake, input, save, select } from './options-fakes';
import { fakeDeps, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

const text = (id: string): string => byId(id).textContent ?? '';
const model = (): HTMLSelectElement => byId<HTMLSelectElement>('model');

function withEndpoint(deps: FakeDeps, url: string): FakeDeps {
  const base = deps.settings;
  const settings: Settings = {
    ...base,
    runtime: 'endpoint',
    endpoint: { ...base.endpoint, url, model: 'vendor/small', apiKey: 'sk-12345678' },
  };
  deps.settings = settings;
  return deps;
}

describe('the question before a remote endpoint is first used', () => {
  let deps: FakeDeps;
  beforeEach(async () => {
    loadPage('sidepanel.html');
    deps = withEndpoint(fakeDeps([answer('hi')]), 'https://openrouter.ai/api/v1');
    await startPanel(deps);
    click('start');
    await settle();
  });

  it('says where the chat goes and what it may cost, and sends nothing before the answer', () => {
    expect(byId('consent').hidden).toBe(false);
    expect(text('consent-title')).toBe('Use openrouter.ai for your questions?');
    const body = text('consent-body');
    expect(body).toMatch(/does not run on this computer/);
    expect(body).toMatch(/your questions, the page.s tool list, tool results and any page text/i);
    expect(body).toMatch(/openrouter\.ai/);
    expect(body).toMatch(/may charge/);
    expect(text('consent-ok')).toBe('Use this service');
    expect(text('consent-no')).toBe('Not now');
    expect(deps.created).toEqual([]);
    expect((deps.model as FakeModelRuntime).requests).toEqual([]);
  });

  it('"Not now" creates nothing and asks again next time', async () => {
    click('consent-no');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(deps.created).toEqual([]);
    expect(deps.panelState.endpointHosts ?? []).toEqual([]);
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(false);
  });

  it('"Use this service" remembers the host: the next start asks nothing', async () => {
    click('consent-ok');
    await settle();
    expect(deps.created.length).toBe(1);
    expect(deps.panelState.endpointHosts).toEqual(['openrouter.ai']);
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(deps.created.length).toBe(2);
  });

  it('asks again when the host changes', async () => {
    click('consent-ok');
    await settle();
    deps.settings = withEndpoint(deps, 'https://llm.example.com/v1').settings;
    await startPanel(deps);
    click('start');
    await settle();
    expect(text('consent-title')).toBe('Use llm.example.com for your questions?');
  });
});

describe('a server on this computer', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it.each(['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1'])(
    'never shows the question for %s',
    async (url) => {
      const deps = withEndpoint(fakeDeps([answer('hi')]), url);
      await startPanel(deps);
      click('start');
      await settle();
      expect(byId('consent').hidden).toBe(true);
      expect(deps.created.length).toBe(1);
    },
  );
});

describe('the model list entry for your own server or a remote service', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('is in the server group while no endpoint is set, and Start opens Options', async () => {
    const deps = fakeDeps([answer('hi')]);
    await startPanel(deps);
    const group = [...document.querySelectorAll<HTMLOptGroupElement>('#model optgroup')][1];
    const entries = [...(group?.querySelectorAll('option') ?? [])];
    expect(entries.map((o) => [o.value, o.textContent])).toEqual([
      ['setup-endpoint', 'Use your own server or a remote service…'],
    ]);
    model().value = 'setup-endpoint';
    click('start');
    await settle();
    expect(deps.optionsOpened).toBe(1);
    expect(deps.created).toEqual([]);
  });

  it('gives way to the endpoint itself once one is set', async () => {
    await startPanel(withEndpoint(fakeDeps([answer('hi')]), 'https://openrouter.ai/api/v1'));
    expect([...model().options].map((o) => o.value)).not.toContain('setup-endpoint');
    expect([...model().options].map((o) => o.value)).toContain('endpoint');
  });
});

describe('Options: the OpenRouter preset', () => {
  beforeEach(() => {
    loadPage('options.html');
  });

  it('lists Ollama, LM Studio, OpenRouter and Other address, in that order', async () => {
    await startOptions(fake());
    expect([...select('endpoint-preset').options].map((o) => o.textContent)).toEqual([
      'Ollama',
      'LM Studio',
      'OpenRouter',
      'Other address',
    ]);
    expect(ENDPOINT_PRESETS.find((p) => p.name === 'OpenRouter')?.url).toBe(
      'https://openrouter.ai/api/v1',
    );
  });

  it('asks for access to openrouter.ai from the Save click only', async () => {
    const deps = fake();
    await startOptions(deps);
    input('rt-endpoint').checked = true;
    choose('endpoint-preset', 'https://openrouter.ai/api/v1');
    expect(input('endpoint-url').value).toBe('https://openrouter.ai/api/v1');
    input('endpoint-model').value = 'vendor/small';
    expect(deps.requested).toEqual([]);
    await save();
    expect(deps.requested).toEqual(['https://openrouter.ai/*']);
    expect(byId('options-status').textContent).toBe('Saved.');
  });
});
