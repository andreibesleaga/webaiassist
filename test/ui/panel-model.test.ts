// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The model bar: the sentence that says why a model is selected, the question before a first
// download, the measured first answer, and the notices (welcome screen, offline).
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { startPanel } from '../../src/ui/panel-controller';
import { answer } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, ORIGIN, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

const CPU = 'cpu:qwen3-1.7b-q4_k_m';
const QWEN = 'webllm:qwen3-1.7b-q4_k_m';
const model = (): HTMLSelectElement => byId<HTMLSelectElement>('model');
const text = (id: string): string => byId(id).textContent ?? '';

function withCpu(deps: FakeDeps): FakeDeps {
  deps.env = { promptApi: false, scripted: false, webgpu: false, cpu: true };
  return deps;
}

describe('why the model is selected', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('shows one reason for the default model: the processor model only without WebGPU', async () => {
    await startPanel(withCpu(fakeDeps([])));
    expect(model().value).toBe(CPU);
    expect(text('model-why')).toMatch(/^Why: this works on every computer\. .*about 1500 MB/);
  });

  it('selects the graphics card when WebGPU works and nothing was measured', async () => {
    const deps = fakeDeps([]);
    deps.env = { promptApi: false, scripted: false, webgpu: true, cpu: true };
    await startPanel(deps);
    expect(model().value).toBe(QWEN);
    expect(text('model-why')).toMatch(/^Why: the browser can use your graphics card\./);
  });

  it('says "you chose this model" once the user picks one, and keeps the choice', async () => {
    const deps = withCpu(fakeDeps([]));
    await startPanel(deps);
    model().value = 'cpu:qwen3-1.7b-q4_k_m';
    model().dispatchEvent(new Event('change'));
    await settle();
    expect(text('model-why')).toBe('Why: you chose this model.');
    expect(deps.settings).toMatchObject({ runtime: 'cpu', cpuModel: 'qwen3-1.7b-q4_k_m' });
    loadPage('sidepanel.html');
    await startPanel(deps);
    expect(model().value).toBe('cpu:qwen3-1.7b-q4_k_m');
    expect(text('model-why')).toBe('Why: you chose this model.');
  });

  it('selects Chrome’s built-in model first when Chrome says it is available', async () => {
    const deps = withCpu(fakeDeps([]));
    deps.env = { ...deps.env, promptApi: true };
    deps.builtInState = () => Promise.resolve('available');
    await startPanel(deps);
    expect(model().value).toBe('prompt-api');
    expect(text('model-why')).toMatch(/^Why: Chrome’s own model is available here/);
  });

  it('selects the graphics card whether its stored first answer was slow or not, and says which', async () => {
    for (const [ms, reason] of [
      [12_000, /^Why: your graphics card passed the check: its first answer took 12 seconds/],
      [40_000, /^Why: .*Its first answer here took 40 seconds.*processor model is in the list/],
    ] as const) {
      loadPage('sidepanel.html');
      const deps = fakeDeps([]);
      deps.env = {
        promptApi: false,
        scripted: false,
        webgpu: true,
        cpu: true,
        gpuKey: 'amd/gcn-5',
      };
      deps.panelState = { firstRunDone: true, gpu: { key: 'amd/gcn-5', firstAnswerMs: ms } };
      await startPanel(deps);
      expect(model().value).toBe(QWEN);
      expect(text('model-why')).toMatch(reason);
    }
  });

  it('ignores a measurement made on another graphics card', async () => {
    const deps = fakeDeps([]);
    deps.env = { promptApi: false, scripted: false, webgpu: true, cpu: true, gpuKey: 'nvidia/ada' };
    deps.panelState = { firstRunDone: true, gpu: { key: 'amd/gcn-5', firstAnswerMs: 1_000 } };
    await startPanel(deps);
    expect(model().value).toBe(QWEN);
    expect(text('model-why')).toMatch(/^Why: the browser can use your graphics card\./);
  });
});

describe('the first answer of a graphics-card model is measured', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('stores the wait for the first token with the adapter name, once', async () => {
    const deps = fakeDeps([answer('hi')]);
    deps.env = { promptApi: false, scripted: false, webgpu: true, gpuKey: 'amd/gcn-5' };
    const slow = new FakeModelRuntime([answer('hi')]);
    const chat = slow.chat.bind(slow);
    slow.chat = (request) => {
      deps.now += 40_000;
      return chat(request);
    };
    deps.model = slow;
    deps.grants.origins.add(ORIGIN);
    await startPanel(deps);
    click('start');
    await settle();
    byId<HTMLTextAreaElement>('question').value = 'hello';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    expect(deps.panelState.gpu).toEqual({ key: 'amd/gcn-5', firstAnswerMs: 40_000 });
  });

  it('measures nothing for the processor model', async () => {
    const deps = withCpu(fakeDeps([answer('hi')]));
    deps.env = { ...deps.env, gpuKey: 'amd/gcn-5' };
    deps.grants.origins.add(ORIGIN);
    await startPanel(deps);
    click('start');
    await settle();
    byId<HTMLTextAreaElement>('question').value = 'hello';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    expect(deps.panelState.gpu).toBeUndefined();
  });
});

describe('the notices', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('shows the welcome screen on the first run and hides it for good after "Got it"', async () => {
    const deps = withCpu(fakeDeps([]));
    deps.panelState = { firstRunDone: false };
    await startPanel(deps);
    expect(byId('first-run').hidden).toBe(false);
    expect(document.activeElement?.id).toBe('first-run-title');
    expect(text('first-run-model')).toMatch(/^We start with Qwen3 1\.7B on the processor\. Why: /);
    expect(text('first-run')).toMatch(
      /Your questions, the page text and the answers stay on this computer/,
    );
    click('first-run-ok');
    await settle();
    expect(byId('first-run').hidden).toBe(true);
    expect(deps.panelState.firstRunDone).toBe(true);
    loadPage('sidepanel.html');
    await startPanel(deps);
    expect(byId('first-run').hidden).toBe(true);
  });

  it('says on the welcome screen that the answers come from an AI and can be wrong', async () => {
    const deps = fakeDeps([]);
    deps.panelState = { firstRunDone: false };
    await startPanel(deps);
    expect(text('first-run')).toMatch(/written by an AI model and can be wrong/);
    expect(text('ai-note')).toMatch(/written by an AI model and can be wrong/);
  });

  it('Help brings the welcome screen back after it was answered, and closing Help hides it', async () => {
    const deps = fakeDeps([]);
    deps.panelState = { firstRunDone: true };
    await startPanel(deps);
    expect(byId('first-run').hidden).toBe(true);
    click('help-toggle');
    expect(byId('first-run').hidden).toBe(false);
    click('help-close');
    expect(byId('first-run').hidden).toBe(true);
    expect(deps.panelState.firstRunDone).toBe(true);
  });

  it('keeps the welcome screen when Help closes before it was ever answered', async () => {
    const deps = fakeDeps([]);
    deps.panelState = { firstRunDone: false };
    await startPanel(deps);
    click('help-toggle');
    click('help-close');
    expect(byId('first-run').hidden).toBe(false);
  });

  it('"Got it" hides the welcome screen that Help brought back', async () => {
    const deps = fakeDeps([]);
    deps.panelState = { firstRunDone: true };
    await startPanel(deps);
    click('help-toggle');
    click('first-run-ok');
    expect(byId('first-run').hidden).toBe(true);
  });

  it('"Choose another model" hides it and focuses the model list', async () => {
    const deps = fakeDeps([]);
    deps.panelState = { firstRunDone: false };
    await startPanel(deps);
    click('first-run-other');
    expect(byId('first-run').hidden).toBe(true);
    expect(document.activeElement?.id).toBe('model');
  });

  it('is gone after the first question too', async () => {
    const deps = fakeDeps([answer('hi')]);
    deps.panelState = { firstRunDone: false };
    deps.grants.origins.add(ORIGIN);
    await startPanel(deps);
    click('start');
    await settle();
    byId<HTMLTextAreaElement>('question').value = 'hello';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    expect(byId('first-run').hidden).toBe(true);
    expect(deps.panelState.firstRunDone).toBe(true);
  });

  it('shows the offline note while the browser is offline, and hides it when it is back', async () => {
    const deps = fakeDeps([]);
    await startPanel(deps);
    expect(byId('offline-banner').hidden).toBe(true);
    deps.online = false;
    window.dispatchEvent(new Event('offline'));
    expect(byId('offline-banner').hidden).toBe(false);
    expect(text('offline-banner')).toBe(
      'You are offline. Models already on this computer work; downloads and endpoints do not.',
    );
    deps.online = true;
    window.dispatchEvent(new Event('online'));
    expect(byId('offline-banner').hidden).toBe(true);
  });
});
