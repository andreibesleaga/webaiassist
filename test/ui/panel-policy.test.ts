// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// What reaches the model from the site's files, and the "no AI input" signal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { answer } from '../helpers';
import { byId, click, loadPage } from './dom';
import { fakeDeps, FakeSite, ORIGIN, type FakeDeps } from './panel-fakes';
import { ask, fakeClock, flush, noAi, nodeOutcomes, open, startModel, text } from './site-helpers';

function setup(outcomes = nodeOutcomes()) {
  const site = new FakeSite();
  site.outcomes = outcomes;
  const model = new FakeModelRuntime([answer('Fine.')]);
  const deps = fakeDeps([], { site });
  deps.model = model;
  deps.grants.origins.add(ORIGIN);
  return { site, model, deps };
}

/** The tool-role messages the model received in its first request. */
const toolMessages = (model: FakeModelRuntime): string[] =>
  (model.requests[0]?.messages ?? []).filter((m) => m.role === 'tool').map((m) => m.content);

async function readPageText(deps: FakeDeps): Promise<void> {
  deps.readPage = () => Promise.resolve({ origin: ORIGIN, title: 'T', text: 'the page words' });
  click('read-page');
  await flush();
}

describe('site facts for the model', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('goes to the model as untrusted data labelled with its source path, before the question', async () => {
    const { model, deps } = setup();
    await open(deps);
    await startModel();
    await ask('What is this site?');
    const facts = toolMessages(model).find((m) => m.includes('/llms.txt'));
    expect(facts).toContain('trust="untrusted"');
    expect(facts).toContain(`Published by ${ORIGIN} in /llms.txt:`);
    const last = model.requests[0]?.messages.at(-1);
    expect(last).toEqual({ role: 'user', content: 'What is this site?' });
  });

  it('is not sent when the Options turn it off', async () => {
    const { model, deps } = setup();
    deps.settings = { ...DEFAULT_SETTINGS, siteFacts: false };
    await open(deps);
    await startModel();
    await ask('What is this site?');
    expect(toolMessages(model)).toEqual([]);
  });

  it('is never stored with the chat', async () => {
    const { deps } = setup();
    await open(deps);
    await startModel();
    await ask('What is this site?');
    const saved = await deps.memoryStore.loadChat(ORIGIN);
    expect(JSON.stringify(saved)).not.toContain('Published by');
  });

  it('is smaller for a model with a small window', async () => {
    const { model, deps } = setup();
    model.capabilities = () => ({
      nativeToolCalls: false,
      jsonConstraint: true,
      contextTokens: 4096,
      compactPrompt: true,
    });
    await open(deps);
    await startModel();
    await ask('What is this site?');
    const total = toolMessages(model).join('').length;
    expect(total).toBeLessThan(2500);
  });
});

describe('a site that asks for no AI input', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('says so in the status line and the card, and does not offer Read this page', async () => {
    const { deps } = setup(noAi());
    await open(deps);
    expect(text('page-status')).toBe(
      'node.example asks that AI does not use its content as input. WebAIAssist does not read this site’s text or files for the model. Results of the site’s own tools still go to the model.',
    );
    expect(text('page-status')).not.toMatch(/sends nothing/);
    expect(text('site-ai')).toContain(
      'this site asks that AI systems do not use its content as input',
    );
    expect(byId('read-page').hidden).toBe(true);
    expect(byId('use-anyway').hidden).toBe(false);
    expect(byId('chat-empty').textContent).toBe(
      'This site asks not to be used as AI input. You can chat without it.',
    );
  });

  it('sends no page text read before the signal was seen', async () => {
    const { site, model, deps } = setup();
    await open(deps);
    await startModel();
    await readPageText(deps);
    site.outcomes = noAi();
    site.emit({ kind: 'access-changed' });
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    await ask('What is this site?');
    expect(toolMessages(model)).toEqual([]);
    expect(JSON.stringify(model.requests)).not.toContain('the page words');
  });

  it('keeps the tools usable and the chat working, with no site text in the question', async () => {
    const { model, deps } = setup(noAi());
    await open(deps);
    await startModel();
    await ask('What is this site?');
    expect(toolMessages(model)).toEqual([]);
    expect(byId('transcript').textContent).toContain('Fine.');
  });

  it('is overridden by "Use on this tab anyway": the card and the question change', async () => {
    const { model, deps } = setup(noAi());
    await open(deps);
    await startModel();
    click('use-anyway');
    await flush();
    expect(byId('use-anyway').hidden).toBe(true);
    expect(byId('read-page').hidden).toBe(false);
    expect(text('site-ai')).toContain('you chose to use it on this tab');
    await ask('What is this site?');
    expect(toolMessages(model).join('')).toContain('/llms.txt');
  });

  it('is asked again after the tab leaves the site (the override is for this tab and site)', async () => {
    const { site, deps } = setup(noAi());
    await open(deps);
    click('use-anyway');
    await flush();
    deps.bridge.pageByTab.set(8, { origin: 'https://other.example', linkset: false, tools: [] });
    deps.currentTab = 8;
    site.emit({ kind: 'tab-activated' });
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    deps.currentTab = 7;
    site.emit({ kind: 'tab-activated' });
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    expect(byId('use-anyway').hidden).toBe(false);
  });

  it('cannot be overridden when the model is a remote endpoint', async () => {
    const { deps } = setup(noAi());
    const panel = await open(deps);
    await startModel();
    panel.state.runtime = {
      ...(panel.state.runtime as NonNullable<typeof panel.state.runtime>),
      remote: true,
    };
    byId('use-anyway').click();
    await flush();
    expect(panel.state.site?.override).toBe(false);
    expect(byId('read-page').hidden).toBe(true);
  });

  it('stops an earlier override at once when the user then starts a remote endpoint (audit M1)', async () => {
    const { model, deps } = setup(noAi());
    deps.settings = {
      ...DEFAULT_SETTINGS,
      endpoint: { ...DEFAULT_SETTINGS.endpoint, url: 'https://api.example.com/v1', model: 'big' },
    };
    await open(deps);
    await startModel();
    click('use-anyway');
    await flush();
    expect(byId('use-anyway').hidden).toBe(true);
    byId<HTMLSelectElement>('model').value = 'endpoint';
    await startModel();
    expect(byId('use-anyway').hidden).toBe(true);
    expect(text('site-ai')).not.toContain('you chose to use it on this tab');
    expect(text('site-ai')).toContain(
      'this site asks that AI systems do not use its content as input',
    );
    await readPageText(deps);
    await ask('What is this site?');
    expect(toolMessages(model).join('')).not.toContain('/llms.txt');
    expect(JSON.stringify(model.requests)).not.toContain('the page words');
  });

  it('refuses Read this page with a plain line even if the button is pressed', async () => {
    const { deps } = setup(noAi());
    await open(deps);
    click('read-page');
    await flush();
    expect(text('page-note')).toBe(
      'This site asks not to be used as AI input, so its text is not read for the model.',
    );
  });

  it('does not block for a training reservation alone (the live node case)', async () => {
    const { deps } = setup();
    await open(deps);
    expect(byId('read-page').hidden).toBe(false);
    expect(byId('use-anyway').hidden).toBe(true);
    expect(text('page-status')).not.toContain('asks that AI');
  });
});
