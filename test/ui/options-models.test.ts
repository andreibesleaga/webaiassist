// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The Options page: where the model runs, the downloaded models, Forget all sites.
import { beforeEach, describe, expect, it } from 'vitest';
import { startOptions } from '../../src/ui/options-page';
import { byId, click, loadPage, tick } from './dom';
import { choose, fake, input, save } from './options-fakes';

describe('Options page: models and privacy', () => {
  beforeEach(() => {
    loadPage('options.html');
  });

  describe('where the model runs', () => {
    it('offers Automatic, the processor, the graphics card, Chrome’s built-in model and an endpoint, each with a line', async () => {
      await startOptions(fake());
      const labels = (
        ['rt-auto', 'rt-cpu', 'rt-webllm', 'rt-prompt-api', 'rt-endpoint'] as const
      ).map((id) => [
        document.querySelector(`label[for="${id}"]`)?.textContent,
        byId(`${id}-help`).textContent,
      ]);
      expect(labels.map(([label]) => label)).toEqual([
        'Automatic (recommended)',
        'Processor and memory',
        'Graphics card',
        'Chrome’s built-in model',
        expect.stringMatching(/chat endpoint/),
      ]);
      expect(labels.every(([, help]) => (help ?? '').length > 20)).toBe(true);
      expect(byId('rt-cpu-help').textContent).toBe(
        'Runs in this browser, on your processor and memory. Works on every computer. Downloads about 397 MB once. Slower than a graphics card. Nothing leaves your computer.',
      );
    });

    it('says for each option where the model runs and whether the chat leaves the computer', async () => {
      await startOptions(fake());
      const help = (id: string): string => byId(`${id}-help`).textContent ?? '';
      expect(help('rt-webllm')).toMatch(/^Runs in this browser, on your graphics card/);
      expect(help('rt-webllm')).toMatch(/Nothing leaves your computer\.$/);
      expect(help('rt-prompt-api')).toMatch(
        /^Runs in Chrome on this computer; Chrome manages the model\./,
      );
      expect(help('rt-endpoint')).toMatch(/An address on this computer keeps your chat on it/);
      expect(help('rt-endpoint')).toMatch(/any other address is remote/);
    });

    it('shows only the fields of the chosen runtime', async () => {
      await startOptions(fake());
      const shown = (): boolean[] =>
        ['cpu-model-field', 'webllm-model-field', 'endpoint-fields'].map((id) => !byId(id).hidden);
      expect(shown()).toEqual([false, false, false]);
      for (const [id, expected] of [
        ['rt-cpu', [true, false, false]],
        ['rt-webllm', [false, true, false]],
        ['rt-endpoint', [false, false, true]],
        ['rt-auto', [false, false, false]],
      ] as const) {
        input(id).checked = true;
        input(id).dispatchEvent(new Event('change'));
        expect(shown()).toEqual(expected);
      }
    });

    it('saves the processor model that was chosen, and keeps it when Options saves again', async () => {
      const deps = fake();
      await startOptions(deps);
      input('rt-cpu').checked = true;
      choose('cpu-model', 'qwen3-1.7b-q4_k_m');
      await save();
      expect(deps.stored).toMatchObject({ runtime: 'cpu', cpuModel: 'qwen3-1.7b-q4_k_m' });
      await save();
      expect(deps.stored.cpuModel).toBe('qwen3-1.7b-q4_k_m');
    });
  });

  describe('downloaded models', () => {
    const rows = (): string[] =>
      [...document.querySelectorAll('#model-store li')].map(
        (li) => li.querySelector('span')?.textContent ?? '',
      );

    it('lists every stored model with its size and a Remove button that names it', async () => {
      await startOptions(fake());
      expect(rows()).toHaveLength(7);
      expect(rows()[4]).toBe('Qwen3 0.6B on the processor: 397 MB');
      const first = document.querySelector('#model-store button');
      expect(first?.getAttribute('aria-label')).toMatch(
        /^Remove Qwen3 0\.6B on the graphics card \(352 MB\)$/,
      );
      expect(byId('model-store-empty').hidden).toBe(true);
      expect(document.body.textContent).toContain('chrome://on-device-internals');
    });

    it('removes one model and says how much space came back', async () => {
      const deps = fake();
      await startOptions(deps);
      (document.querySelectorAll('#model-store button')[4] as HTMLButtonElement).click();
      for (let i = 0; i < 5; i += 1) await tick();
      expect(deps.store.removed).toEqual(['cpu:qwen3-0.6b-q4_k_m']);
      expect(rows()).toHaveLength(6);
      expect(byId('options-status').textContent).toMatch(
        /^Removed Qwen3 0\.6B on the processor.*; 397 MB freed\.$/,
      );
    });

    it('asks before it removes all, and "Keep" removes nothing', async () => {
      const deps = fake();
      await startOptions(deps);
      click('remove-all-models');
      for (let i = 0; i < 5; i += 1) await tick();
      expect(byId('remove-confirm').hidden).toBe(false);
      expect(byId('remove-confirm-text').textContent).toBe('Remove 7 models and free 8856 MB?');
      click('remove-confirm-no');
      expect(byId('remove-confirm').hidden).toBe(true);
      expect(deps.store.removed).toEqual([]);
    });

    it('removes all, shows the empty list and the space freed', async () => {
      const deps = fake();
      await startOptions(deps);
      click('remove-all-models');
      for (let i = 0; i < 5; i += 1) await tick();
      click('remove-confirm-ok');
      for (let i = 0; i < 5; i += 1) await tick();
      expect(deps.store.stored).toEqual([]);
      expect(rows()).toEqual([]);
      expect(byId('model-store-empty').hidden).toBe(false);
      expect(byId('remove-all-models').hidden).toBe(true);
      expect(byId('options-status').textContent).toBe('Removed 7 models; 8856 MB freed.');
    });

    it('says "1 model", not "1 models", when one is stored', async () => {
      const deps = fake();
      deps.store.stored = deps.store.stored.slice(4, 5);
      await startOptions(deps);
      click('remove-all-models');
      for (let i = 0; i < 5; i += 1) await tick();
      expect(byId('remove-confirm-text').textContent).toBe('Remove 1 model and free 397 MB?');
      click('remove-confirm-ok');
      for (let i = 0; i < 5; i += 1) await tick();
      expect(byId('options-status').textContent).toBe('Removed 1 model; 397 MB freed.');
    });

    it('says plainly that nothing is stored, and shows no remove-all button', async () => {
      const deps = fake();
      deps.store.stored = [];
      await startOptions(deps);
      expect(byId('model-store-empty').textContent).toBe('No models are stored in this browser.');
      expect(byId('remove-all-models').hidden).toBe(true);
    });

    it('says a model could not be removed and shows what is still stored', async () => {
      const deps = fake();
      deps.store.remove = () => Promise.reject(new Error('the file is in use'));
      await startOptions(deps);
      (document.querySelector('#model-store button') as HTMLButtonElement).click();
      for (let i = 0; i < 5; i += 1) await tick();
      expect(byId('options-status').textContent).toBe(
        'A model could not be removed: the file is in use',
      );
      expect(rows()).toHaveLength(7);
    });

    it('lists the three larger graphics-card models, each with its size, so they can be removed', async () => {
      await startOptions(fake());
      expect(rows().slice(1, 4)).toEqual([
        'Qwen3.5 2B on the graphics card: 1072 MB',
        'Llama 3.2 3B on the graphics card: 1817 MB',
        'Gemma 4 E2B on the graphics card: 2830 MB',
      ]);
      expect(rows()[6]).toBe('Qwen3.5 2B on the processor: 1281 MB');
    });
  });

  it('forgets all sites from Options', async () => {
    const deps = fake();
    await startOptions(deps);
    click('forget-all');
    for (let i = 0; i < 5; i += 1) await tick();
    expect(deps.forgotten).toBe(1);
    expect(byId('options-status').textContent).toMatch(/^Forgot all sites/);
  });

  it('states the privacy line', async () => {
    await startOptions(fake());
    expect(document.body.textContent).toContain(
      'WebAIAssist sends nothing to its authors and has no tracking.',
    );
  });
});
