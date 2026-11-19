// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The question before a first download: size, source, "Download" and "Not now".
import { beforeEach, describe, expect, it } from 'vitest';
import { startPanel } from '../../src/ui/panel-controller';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

const CPU = 'cpu:qwen3-1.7b-q4_k_m';
const QWEN = 'webllm:qwen3-0.6b-q4_k_m';
const model = (): HTMLSelectElement => byId<HTMLSelectElement>('model');
const text = (id: string): string => byId(id).textContent ?? '';

function withCpu(deps: FakeDeps): FakeDeps {
  deps.env = { promptApi: false, scripted: false, webgpu: false, cpu: true };
  return deps;
}

describe('the question before a first download', () => {
  let deps: FakeDeps;
  beforeEach(async () => {
    loadPage('sidepanel.html');
    deps = withCpu(fakeDeps([]));
    deps.store.stored = [];
    await startPanel(deps);
    click('start');
    await settle();
  });

  it('shows the size and the source and waits: nothing is created or downloaded', () => {
    expect(byId('consent').hidden).toBe(false);
    expect(text('consent-title')).toBe('Download Qwen3 1.7B on the processor?');
    expect(text('consent-body')).toMatch(/1107 MB, once\. From huggingface\.co/);
    expect(text('consent-body')).toMatch(/Stored in this browser/);
    expect(text('model-status')).toMatch(/must download 1107 MB once/);
    expect(byId<HTMLButtonElement>('start').disabled).toBe(true);
    expect(deps.created).toEqual([]);
    expect(document.activeElement?.id).toBe('consent-ok');
  });

  it('"Not now" changes nothing and puts the focus back on Start', async () => {
    click('consent-no');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(byId<HTMLButtonElement>('start').disabled).toBe(false);
    expect(document.activeElement?.id).toBe('start');
    expect(text('model-status')).toBe('No model loaded. Press Start.');
    expect(deps.created).toEqual([]);
  });

  it('Escape means "Not now"', () => {
    byId('consent').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(byId('consent').hidden).toBe(true);
    expect(deps.created).toEqual([]);
  });

  it('"Download" starts the load', async () => {
    click('consent-ok');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(deps.created.map((c) => c.value)).toEqual([CPU]);
    expect(text('model-status')).toMatch(/^Ready: /);
  });

  it('is shown again by the next Start when the answer was "Not now"', async () => {
    click('consent-no');
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(false);
  });

  it('is not shown for a model that is already stored', async () => {
    loadPage('sidepanel.html');
    deps.store.stored = [
      { runtime: 'cpu', id: 'qwen3-1.7b-q4_k_m', name: 'Qwen3 1.7B', bytes: 1_107_409_472 },
    ];
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(deps.created).toHaveLength(1);
  });

  it('closes when another model is chosen', async () => {
    model().value = QWEN;
    model().dispatchEvent(new Event('change'));
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(byId<HTMLButtonElement>('start').disabled).toBe(false);
  });
});

describe('the question for other kinds of download', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('names the graphics-card model with its size and the checked download', async () => {
    const deps = fakeDeps([]);
    deps.store.stored = [];
    await startPanel(deps);
    click('start');
    await settle();
    expect(text('consent-title')).toBe('Download Qwen3 1.7B?');
    expect(text('consent-body')).toMatch(
      /^1107 MB, once\. From huggingface\.co \(checksum checked before use\)\./,
    );
  });

  it('asks nothing for a graphics-card model whose file is stored for the processor, and the other way round', async () => {
    const file = {
      runtime: 'cpu' as const,
      id: 'qwen3-0.6b-q4_k_m',
      name: 'Qwen3 0.6B',
      bytes: 396_705_472,
    };
    for (const pick of ['webllm:qwen3-0.6b-q4_k_m', 'cpu:qwen3-0.6b-q4_k_m']) {
      loadPage('sidepanel.html');
      const deps = fakeDeps([]);
      deps.env = { promptApi: false, scripted: false, webgpu: true, cpu: true };
      deps.store.stored = [file];
      await startPanel(deps);
      model().value = pick;
      model().dispatchEvent(new Event('change'));
      click('start');
      await settle();
      expect(byId('consent').hidden).toBe(true);
      expect(deps.created.map((c) => c.value)).toEqual([pick]);
    }
  });

  it.each([
    ['Qwen3.5 2B', 'qwen3.5-2b-q4_k_m', '1281'],
    ['Gemma 4 E2B', 'gemma-4-e2b-it-q4_k_m', '3107'],
  ])('asks before the first download of %s with its size and source', async (name, id, mb) => {
    const deps = fakeDeps([]);
    deps.store.stored = [];
    await startPanel(deps);
    model().value = `webllm:${id}`;
    model().dispatchEvent(new Event('change'));
    click('start');
    await settle();
    expect(text('consent-title')).toBe(`Download ${name}?`);
    expect(text('consent-body')).toMatch(
      new RegExp(`^${mb} MB, once\\. From huggingface\\.co \\(checksum checked before use\\)`),
    );
    expect(deps.created).toEqual([]);
  });

  it('says that Chrome downloads its own model, when Chrome says it must', async () => {
    const deps = fakeDeps([]);
    deps.env = { promptApi: true, scripted: false, webgpu: false };
    deps.builtInState = () => Promise.resolve('downloadable');
    await startPanel(deps);
    expect(model().value).toBe('prompt-api');
    click('start');
    await settle();
    expect(text('consent-title')).toBe('Let Chrome download its own model?');
    expect(text('consent-body')).toMatch(/22 GB free disk/);
    expect(deps.created).toEqual([]);
    click('consent-ok');
    await settle();
    expect(deps.created.map((c) => c.value)).toEqual(['prompt-api']);
  });

  it('asks nothing for Chrome’s model that is ready, or for an endpoint', async () => {
    const deps = fakeDeps([]);
    deps.env = { promptApi: true, scripted: false, webgpu: false };
    deps.builtInState = () => Promise.resolve('available');
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('consent').hidden).toBe(true);
    expect(deps.created).toHaveLength(1);
  });

  it('offline, says the model is not on this computer and offers no download', async () => {
    const deps = withCpu(fakeDeps([]));
    deps.store.stored = [];
    deps.online = false;
    await startPanel(deps);
    click('start');
    await settle();
    expect(text('consent-body')).toBe(
      'Qwen3 1.7B on the processor is not on this computer and you are offline. Connect and press Start.',
    );
    expect(byId('consent-ok').hidden).toBe(true);
    expect(deps.created).toEqual([]);
  });
});
