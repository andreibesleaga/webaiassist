// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Side panel privacy actions: "Forget this site", and the API key left out of the export.
import { beforeEach, describe, expect, it } from 'vitest';
import type { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import { startPanel } from '../../src/ui/panel-controller';
import { answer } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

async function ask(text: string): Promise<void> {
  byId<HTMLTextAreaElement>('question').value = text;
  byId<HTMLFormElement>('ask').requestSubmit();
  await settle();
}

describe('side panel privacy actions', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('forgets the open site on "Forget this site"', async () => {
    const deps = fakeDeps([]);
    await startPanel(deps);
    click('forget');
    await settle();
    expect(deps.forgotten).toEqual([ORIGIN]);
    expect(byId('page-note').textContent).toBe(
      `WebAIAssist forgot ${ORIGIN}: its memory, its tool permission and compat mode.`,
    );
  });

  it('says what went wrong when forgetting fails', async () => {
    const deps = fakeDeps([]);
    deps.forgetError = new Error('storage is gone');
    await startPanel(deps);
    click('forget');
    await settle();
    expect(byId('page-note').textContent).toBe('storage is gone');
  });

  it('says "Forget this site" needs a web page when there is none', async () => {
    const bridge = new FakePanelBridge();
    bridge.pageResult = new PageError('No page.');
    const none = fakeDeps([], { bridge });
    await startPanel(none);
    click('forget');
    await settle();
    expect(none.forgotten).toEqual([]);
    expect(byId('page-note').textContent).toContain('Open a web page first');
  });

  it('leaves the endpoint API key out of the export, even when the user typed it', async () => {
    const deps = fakeDeps([answer('Noted.')]);
    deps.settings = {
      ...deps.settings,
      endpoint: { ...deps.settings.endpoint, apiKey: 'sk-secret-123456' },
    };
    deps.grants.origins.add(ORIGIN);
    await startPanel(deps);
    click('start');
    await settle();
    await ask('my key is sk-secret-123456');
    click('export');
    expect(deps.downloads[0]?.text).toContain('my key is [redacted]');
    expect(deps.downloads[0]?.text).not.toContain('sk-secret-123456');
  });

  it('keeps the endpoint API key out of every message sent to the model (F15.7)', async () => {
    const deps = fakeDeps([answer('Noted.')]);
    deps.settings = {
      ...deps.settings,
      endpoint: { ...deps.settings.endpoint, apiKey: 'sk-secret-123456' },
    };
    deps.grants.origins.add(ORIGIN);
    await startPanel(deps);
    click('start');
    await settle();
    await ask('What can I do here?');
    const requests = (deps.model as FakeModelRuntime).requests;
    expect(requests.length).toBeGreaterThan(0);
    expect(JSON.stringify(requests.map((r) => r.messages))).not.toContain('sk-secret-123456');
  });

  it('says that the chat goes to the endpoint host once an endpoint model is ready (F17.3)', async () => {
    const deps = fakeDeps([answer('Noted.')]);
    deps.settings = {
      ...deps.settings,
      runtime: 'endpoint',
      endpoint: {
        ...deps.settings.endpoint,
        url: 'https://api.example.com/v1',
        model: 'big-model',
      },
    };
    await startPanel(deps);
    click('start');
    await settle();
    const line = byId('model-status').textContent ?? '';
    expect(line).toContain('big-model');
    expect(line).toContain('api.example.com');
    expect(line).toMatch(/questions, page text and tool results/);
    expect(line).toMatch(/^Ready: big-model\. Remote: /);
  });

  it('says a server on this computer is your own and nothing leaves the computer', async () => {
    const deps = fakeDeps([answer('Noted.')]);
    deps.settings = {
      ...deps.settings,
      runtime: 'endpoint',
      endpoint: {
        ...deps.settings.endpoint,
        url: 'http://localhost:11434/v1',
        model: 'qwen3:0.6b',
      },
    };
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('model-status').textContent).toBe(
      'Ready: qwen3:0.6b. Your own server on this computer (localhost:11434); nothing leaves this computer.',
    );
  });

  it('says where a model on this computer runs: in this browser, nothing leaves the computer', async () => {
    const deps = fakeDeps([answer('Noted.')]);
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('model-status').textContent ?? '').toMatch(/Running in this browser, on your/);
  });

  it('says nothing about a remote host for a model on this computer (F17.3)', async () => {
    const deps = fakeDeps([answer('Noted.')]);
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('model-status').textContent ?? '').not.toMatch(/goes to|go to/);
  });
});
