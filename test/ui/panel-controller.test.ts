// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import type { ChatRequest } from '../../src/core/ports/model-runtime';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { startPanel, type PanelController } from '../../src/ui/panel-controller';
import { answer, call } from '../helpers';
import { byId, click, key, loadPage, tick } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

async function ask(text: string): Promise<void> {
  byId<HTMLTextAreaElement>('question').value = text;
  byId<HTMLFormElement>('ask').requestSubmit();
  await settle();
}

function transcript(): string {
  return byId('transcript').textContent ?? '';
}

async function started(deps: FakeDeps): Promise<PanelController> {
  const panel = await startPanel(deps);
  click('start');
  await settle();
  return panel;
}

describe('side panel controller', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('says where the model runs when the host reports it', async () => {
    const deps = fakeDeps([answer('hi')]);
    deps.model = Object.assign(new FakeModelRuntime([]), { where: () => 'offscreen-main' });
    await started(deps);
    expect(byId('model-status').textContent).toMatch(
      /^Ready: Qwen3 0\.6B\. Running in this browser, on your graphics card \(on the offscreen document’s main thread: WebGPU did not work in its Worker\)\.$/,
    );
  });

  it('fills the model list and loads the selected model on Start', async () => {
    const deps = fakeDeps([answer('hi')]);
    await startPanel(deps);
    const options = [...byId<HTMLSelectElement>('model').options].map((o) => o.value);
    expect(options).toEqual([
      'webllm:Qwen3-0.6B-q4f16_1-MLC',
      'webllm:Llama-3.2-3B-Instruct-q4f16_1-MLC',
      'webllm:Qwen3.5-2B-q4f16_1-MLC',
      'webllm:gemma-4-E2B-it-q4f16_1-MLC',
    ]);
    click('start');
    await settle();
    expect(deps.created.map((c) => c.modelId)).toEqual(['Qwen3-0.6B-q4f16_1-MLC']);
    expect(byId('model-status').textContent).toBe(
      'Ready: Qwen3 0.6B. Running in this browser, on your graphics card (in the offscreen document).',
    );
  });

  it('answers Cancel at once while the runtime still winds down', async () => {
    let finish = (): void => undefined;
    const slow = new FakeModelRuntime([]);
    slow.load = () => new Promise<void>((done) => (finish = done));
    let unloads = 0;
    slow.unload = () => {
      unloads += 1;
      return Promise.resolve();
    };
    const deps = fakeDeps([]);
    deps.model = slow;
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId<HTMLButtonElement>('start').disabled).toBe(true);
    expect(byId('cancel-load').hidden).toBe(false);
    click('cancel-load');
    await settle();
    expect(byId('model-status').textContent).toBe(
      'The model did not load: the download was cancelled.',
    );
    expect(byId<HTMLButtonElement>('start').disabled).toBe(false);
    expect(byId('cancel-load').hidden).toBe(true);
    finish(); // the runtime settles later: nothing shown, the model it loaded is let go
    await settle();
    expect(byId('model-status').textContent).toContain('cancelled');
    expect(unloads).toBe(1);
  });

  it('shows why the model did not load', async () => {
    const deps = fakeDeps([]);
    deps.createRuntime = () => Promise.reject(new Error('no WebGPU adapter'));
    await started(deps);
    expect(byId('model-status').textContent).toBe('The model did not load: no WebGPU adapter');
  });

  it('saves the model chosen in the panel', async () => {
    const deps = fakeDeps([]);
    await startPanel(deps);
    const select = byId<HTMLSelectElement>('model');
    select.value = 'webllm:Llama-3.2-3B-Instruct-q4f16_1-MLC';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(deps.saved.at(-1)?.webllmModel).toBe('Llama-3.2-3B-Instruct-q4f16_1-MLC');
  });

  it('keeps the model chosen in the panel when the Options change', async () => {
    const deps = fakeDeps([]);
    deps.env = { ...deps.env, scripted: true };
    const panel = await startPanel(deps);
    const select = byId<HTMLSelectElement>('model');
    select.value = 'scripted';
    select.dispatchEvent(new Event('change'));
    await panel.reloadSettings();
    expect(select.value).toBe('scripted');
  });

  it('asks to press Start before a question', async () => {
    const deps = fakeDeps([answer('x')]);
    await startPanel(deps);
    await ask('hello');
    expect(transcript()).toContain('Error: Press Start to load a model first.');
  });

  it('shows the page and its tool count, and node mode for a node page', async () => {
    const deps = fakeDeps([], { bridge: new FakePanelBridge(undefined, true) });
    await startPanel(deps);
    expect(byId('page-status').textContent).toBe(
      'node.example — says it is an AgenticSystemCore node, 10 WebMCP tools',
    );
  });

  it('asks for the site once per session, then runs the loop with every-call confirmation', async () => {
    const deps = fakeDeps([call('search', { query: 'a' }), answer('Found.'), answer('Again.')]);
    await started(deps);
    byId<HTMLTextAreaElement>('question').value = 'find a';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    expect(byId('confirm-title').textContent).toBe('Use the tools of https://node.example?');
    click('confirm-allow');
    await settle();
    expect(byId('confirm-title').textContent).toBe('Run the tool search?');
    click('confirm-allow');
    await settle();
    expect(transcript()).toContain('WebAIAssistFound.');
    expect(transcript()).toContain('Result of search (from the page)');
    expect([...deps.grants.origins]).toEqual([ORIGIN]);
    await ask('again');
    expect(transcript()).toContain('WebAIAssistAgain.');
    expect(byId<HTMLDialogElement>('confirm').open).toBe(false);
    expect(await deps.memoryStore.loadChat(ORIGIN)).not.toHaveLength(0);
  });

  it('runs read-only tools without asking in per-site mode', async () => {
    const deps = fakeDeps([call('search', { query: 'a' }), answer('Found.')]);
    deps.settings = { ...deps.settings, confirmMode: 'per-site' };
    deps.grants.origins.add(ORIGIN);
    await started(deps);
    await ask('find a');
    expect(transcript()).toContain('WebAIAssistFound.');
    expect(deps.bridge.calls).toHaveLength(1);
  });

  it('answers without tools when the site is denied, and says so', async () => {
    const deps = fakeDeps([answer('No tools used.')]);
    await started(deps);
    byId<HTMLTextAreaElement>('question').value = 'q';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    click('confirm-deny');
    await settle();
    expect(byId('page-note').textContent).toBe(
      'You did not allow this site’s tools, so the answer uses none.',
    );
    expect(transcript()).toContain('No tools used.');
    const system = (deps.model as FakeModelRuntime).requests[0]?.messages[0]?.content;
    expect(system).toContain('No tools are available on this page.');
  });

  it('answers on a page with no WebMCP tools and says what to do', async () => {
    const bridge = new FakePanelBridge();
    bridge.pageResult = { origin: 'https://plain.example', linkset: false, tools: [] };
    const deps = fakeDeps([answer('Plain.')], { bridge });
    await started(deps);
    expect(byId('page-status').textContent).toBe(
      'plain.example — no WebMCP tools (use Read this page or Add WebMCP to this site)',
    );
    await ask('q');
    expect(transcript()).toContain('Plain.');
  });

  it('gives the page text to the next question as untrusted content', async () => {
    const deps = fakeDeps([answer('About cats.')]);
    deps.grants.origins.add(ORIGIN);
    await started(deps);
    click('read-page');
    await settle();
    expect(transcript()).toContain('Result of read-this-page (from the page)');
    await ask('what is it about?');
    const messages = (deps.model as FakeModelRuntime).requests[0]?.messages ?? [];
    expect(messages.some((m) => m.content.includes('trust="untrusted">\nCats are calm.'))).toBe(
      true,
    );
  });

  it('stops a running answer with Stop or Escape', async () => {
    const deps = fakeDeps([]);
    deps.grants.origins.add(ORIGIN);
    let started = 0;
    deps.model = new (class extends FakeModelRuntime {
      override chat(request: ChatRequest): Promise<string> {
        started += 1;
        return new Promise((resolve) => {
          (request.signal as AbortSignal).addEventListener('abort', () => resolve('{"answer"'));
        });
      }
    })([]);
    await startPanel(deps).then(() => click('start'));
    await settle();
    byId<HTMLTextAreaElement>('question').value = 'long';
    key(byId('question'), 'Enter', { ctrlKey: true });
    await settle();
    expect(started).toBe(1);
    expect(byId<HTMLButtonElement>('stop').disabled).toBe(false);
    expect(byId<HTMLButtonElement>('send').disabled).toBe(true);
    key(document.body, 'Escape');
    await settle();
    expect(transcript()).toContain('Stopped.');
    expect(byId<HTMLButtonElement>('stop').disabled).toBe(true);
    expect(byId<HTMLButtonElement>('send').disabled).toBe(false);
  });

  it('turns compat mode on for the open site, from the click itself', async () => {
    const deps = fakeDeps([]);
    await startPanel(deps);
    click('compat');
    expect(deps.compatCalls).toEqual([{ tabId: 7, origin: ORIGIN }]);
    await settle();
    expect(byId('page-note').textContent).toContain('Compat mode is on for https://node.example');
    deps.compatResult = 'denied';
    click('compat');
    await settle();
    expect(byId('page-note').textContent).toContain('it was not given');
  });

  it('says compat mode needs a web page when there is none', async () => {
    const bridge = new FakePanelBridge();
    bridge.pageResult = new PageError('No page.');
    const deps = fakeDeps([], { bridge });
    await startPanel(deps);
    click('compat');
    await settle();
    expect(deps.compatCalls).toEqual([]);
    expect(byId('page-note').textContent).toContain('http and https pages');
  });

  it('exports the conversation as Markdown', async () => {
    const deps = fakeDeps([answer('Done.')]);
    deps.grants.origins.add(ORIGIN);
    click('export');
    await startPanel(deps);
    click('export');
    expect(byId('page-note').textContent).toBe('There is nothing to export yet.');
    click('start');
    await settle();
    await ask('hello');
    click('export');
    expect(deps.downloads[0]?.name).toBe('webaiassist-conversation.md');
    expect(deps.downloads[0]?.text).toContain('## You\n\nhello');
    expect(deps.downloads[0]?.text).toContain('- Site: https://node.example');
  });

  it('opens the help and the options, keyboard only', async () => {
    const deps = fakeDeps([]);
    await startPanel(deps);
    const toggle = byId('help-toggle');
    click('help-toggle');
    expect(byId('help').hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    click('help-close');
    expect(byId('help').hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
    click('open-options');
    expect(deps.optionsOpened).toBe(1);
  });
});
