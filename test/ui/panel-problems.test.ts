// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// What the panel shows when a model cannot load or stops: one banner with the next step.
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { startPanel } from '../../src/ui/panel-controller';
import { NoGpuError } from '../../src/ui/problems';
import { answer } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, ORIGIN, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

const banner = (): string => byId('error-text').textContent ?? '';
const buttons = (): string[] =>
  [...byId('error-actions').querySelectorAll('button')].map((b) => b.id);

async function ask(text: string): Promise<void> {
  byId<HTMLTextAreaElement>('question').value = text;
  byId<HTMLFormElement>('ask').requestSubmit();
  await settle();
}

function cpuDeps(): FakeDeps {
  const deps = fakeDeps([answer('hi')]);
  deps.env = { promptApi: false, scripted: false, webgpu: false, cpu: true };
  deps.grants.origins.add(ORIGIN);
  return deps;
}

describe('failures shown in the banner', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('no graphics acceleration: says why and offers the processor model in one click', async () => {
    const deps = cpuDeps();
    deps.createRuntime = () =>
      Promise.reject(
        new NoGpuError('This browser has no usable graphics acceleration here: no adapter.'),
      );
    await startPanel(deps);
    byId<HTMLSelectElement>('model').value = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
    click('start');
    await settle();
    expect(banner()).toBe('This browser has no usable graphics acceleration here: no adapter.');
    expect(byId('error-banner').getAttribute('role')).toBe('alert');
    expect(buttons()).toEqual(['use-cpu']);
    expect(byId('use-cpu').textContent).toBe('Use the processor instead');
    click('use-cpu');
    await settle();
    expect(byId<HTMLSelectElement>('model').value).toBe('cpu:qwen3-0.6b-q4_k_m');
    expect(deps.settings.runtime).toBe('cpu');
    expect(byId('error-banner').hidden).toBe(true);
  });

  it('an endpoint that refuses the request says so, names it, and points to Options', async () => {
    const deps = fakeDeps([answer('hi')]);
    deps.settings = {
      ...deps.settings,
      endpoint: {
        ...deps.settings.endpoint,
        url: 'http://localhost:11434/v1',
        model: 'qwen3:0.6b',
      },
    };
    deps.createRuntime = () => Promise.reject(new Error('The endpoint answered 401.'));
    await startPanel(deps);
    byId<HTMLSelectElement>('model').value = 'endpoint';
    click('start');
    await settle();
    expect(banner()).toBe(
      'The endpoint at localhost:11434 refused the request. Check the API key in Options.',
    );
    expect(buttons()).toEqual(['open-storage']);
    expect(byId('open-storage').textContent).toBe('Open Options');
  });

  it('reports it before the question about a download, when the hosts find no adapter either', async () => {
    const deps = cpuDeps();
    deps.store.stored = [];
    deps.createRuntime = () => Promise.reject(new NoGpuError('no graphics here'));
    await startPanel(deps);
    byId<HTMLSelectElement>('model').value = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(banner()).toBe('no graphics here');
  });

  it('still asks before the download when only the panel’s own probe found no adapter', async () => {
    const deps = cpuDeps();
    deps.store.stored = [];
    await startPanel(deps);
    byId<HTMLSelectElement>('model').value = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(false);
    expect(byId('error-banner').hidden).toBe(true);
  });

  it('offers no processor button when this browser cannot run the processor model', async () => {
    const deps = fakeDeps([]);
    deps.createRuntime = () => Promise.reject(new NoGpuError('no graphics'));
    await startPanel(deps);
    click('start');
    await settle();
    expect(buttons()).toEqual([]);
  });

  it('a lost graphics device while answering: banner with restart and the processor, chat kept', async () => {
    const deps = cpuDeps();
    deps.env = { ...deps.env, webgpu: true };
    const model = new FakeModelRuntime([]);
    model.chat = () =>
      Promise.reject(new Error('Object has already been disposed (DXGI_ERROR_DEVICE_REMOVED)'));
    deps.model = model;
    await startPanel(deps);
    byId<HTMLSelectElement>('model').value = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
    click('start');
    await settle();
    await ask('hello');
    expect(banner()).toMatch(/^The graphics device was lost/);
    expect(buttons()).toEqual(['restart-model', 'use-cpu']);
    expect(byId('transcript').textContent).toContain('hello');
    deps.created.length = 0;
    click('restart-model');
    await settle();
    expect(deps.created).toHaveLength(1);
  });

  /** The owner's laptop run of 14 Nov 2026: Llama 3.2 3B lost the device on its first question,
   *  and the panel kept saying "Ready" and showed the library's own sentence. */
  async function askOnDeadEngine(why: string): Promise<FakeDeps> {
    const deps = cpuDeps();
    deps.env = { ...deps.env, webgpu: true };
    const model = new FakeModelRuntime([]);
    model.chat = () => Promise.reject(new Error(why));
    deps.model = model;
    await startPanel(deps);
    byId<HTMLSelectElement>('model').value = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
    click('start');
    await settle();
    expect(byId('model-status').textContent).toMatch(/^Ready: /);
    await ask('hello');
    return deps;
  }

  it('a freed engine: the model line stops saying Ready, the chat shows plain words, not the library text', async () => {
    await askOnDeadEngine('Error: Object has already been disposed');
    expect(banner()).toMatch(/^The graphics device was lost/);
    expect(byId('model-status').textContent).toBe(
      'The model stopped. Press Start to load it again.',
    );
    const shown = byId('transcript').textContent ?? '';
    expect(shown).toContain('hello');
    expect(shown).not.toMatch(/already been disposed/);
  });

  it('an engine WebLLM no longer has: plain message, Restart and the processor, line not Ready', async () => {
    await askOnDeadEngine('The model stopped. Press Start to load it again.');
    expect(banner()).toBe('The model stopped. Press Start to load it again.');
    expect(buttons()).toEqual(['restart-model', 'use-cpu']);
    expect(byId('model-status').textContent).toBe(
      'The model stopped. Press Start to load it again.',
    );
    expect(byId('transcript').textContent).not.toMatch(/ModelNotLoaded|MLCEngine/);
  });

  it('after a stopped model a question says there is no model until Start loads it again', async () => {
    const deps = await askOnDeadEngine('The model stopped. Press Start to load it again.');
    await ask('again');
    expect(byId('transcript').textContent).toContain('Press Start to load a model first.');
    deps.created.length = 0;
    click('start');
    await settle();
    expect(deps.created).toHaveLength(1);
    expect(byId('model-status').textContent).toMatch(/^Ready: /);
  });

  it('no space: names the size and points to Options', async () => {
    const deps = cpuDeps();
    deps.createRuntime = () =>
      Promise.reject(new Error('QuotaExceededError: the quota has been exceeded'));
    await startPanel(deps);
    click('start');
    await settle();
    expect(banner()).toBe(
      'The browser has no space to store the model (1107 MB). Remove downloaded models in Options, or free disk space, then press Start.',
    );
    click('open-storage');
    expect(deps.optionsOpened).toBe(1);
  });

  it('an unexpected failure while answering: says so, offers Copy details with no page content', async () => {
    const deps = cpuDeps();
    const model = new FakeModelRuntime([]);
    model.chat = () => Promise.reject(new Error('the model crashed'));
    deps.model = model;
    await startPanel(deps);
    click('start');
    await settle();
    await ask('What does https://private.example hold?');
    expect(banner()).toBe(
      'Something went wrong: the model crashed. Nothing was changed on the page.',
    );
    click('copy-error');
    await settle();
    expect(deps.copied).toEqual(['WebAIAssist 0.1.0-test\nthe model crashed']);
    expect(byId('page-note').textContent).toMatch(/^Details copied/);
  });

  it('an unexpected load failure keeps the model line only: no banner', async () => {
    const deps = cpuDeps();
    deps.createRuntime = () => Promise.reject(new Error('some odd reason'));
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('model-status').textContent).toBe('The model did not load: some odd reason');
    expect(byId('error-banner').hidden).toBe(true);
  });

  it('Dismiss hides the banner', async () => {
    const deps = cpuDeps();
    deps.createRuntime = () => Promise.reject(new Error('DEVICE_REMOVED'));
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('error-banner').hidden).toBe(false);
    click('error-dismiss');
    expect(byId('error-banner').hidden).toBe(true);
    expect(buttons()).toEqual([]);
  });
});
