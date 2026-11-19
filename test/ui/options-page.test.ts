// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { startOptions } from '../../src/ui/options-page';
import { byId, click, loadPage, tick } from './dom';

import { choose, fake, input, save, select } from './options-fakes';

describe('Options page', () => {
  beforeEach(() => {
    loadPage('options.html');
  });

  it('shows the stored settings, with a plain explanation beside each option', async () => {
    await startOptions(fake());
    expect(input('rt-auto').checked).toBe(true);
    expect(select('webllm-model').value).toBe('');
    expect(input('cm-every').checked).toBe(true);
    expect(input('max-steps').value).toBe('6');
    expect(input('memory').checked).toBe(true);
    expect(input('site-facts').checked).toBe(true);
    expect(input('endpoint-url').value).toBe('http://localhost:11434/v1');
    expect(select('endpoint-preset').value).toBe('http://localhost:11434/v1');
    expect(byId('max-steps-help').textContent).toMatch(/1 to 12/);
    expect([...select('webllm-model').options].map((o) => o.value)).toEqual([
      '',
      'qwen3-0.6b-q4_k_m',
      'qwen3-1.7b-q4_k_m',
      'qwen3.5-2b-q4_k_m',
      'llama-3.2-3b-instruct-q4_k_m',
      'gemma-4-e2b-it-q4_k_m',
    ]);
    expect(document.getElementById('webllm-other')).toBeNull();
  });

  it('saves the choices', async () => {
    const deps = fake();
    await startOptions(deps);
    input('cm-site').checked = true;
    input('max-steps').value = '9';
    input('memory').checked = false;
    input('site-facts').checked = false;
    choose('webllm-model', 'llama-3.2-3b-instruct-q4_k_m');
    await save();
    expect(deps.stored).toMatchObject({
      confirmMode: 'per-site',
      maxSteps: 9,
      memory: false,
      siteFacts: false,
      webllmModel: 'llama-3.2-3b-instruct-q4_k_m',
    });
    expect(byId('options-status').textContent).toBe('Saved.');
    expect(deps.requested).toEqual([]);
  });

  it('shows a stored model id that is not shipped as "automatic"', async () => {
    await startOptions(
      fake({ ...DEFAULT_SETTINGS, webllmModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC' }),
    );
    expect(select('webllm-model').value).toBe('');
  });

  it('asks for access to the endpoint’s site when saving an endpoint', async () => {
    const deps = fake();
    await startOptions(deps);
    input('rt-endpoint').checked = true;
    choose('endpoint-preset', 'http://localhost:1234/v1');
    expect(input('endpoint-url').value).toBe('http://localhost:1234/v1');
    input('endpoint-model').value = 'qwen3-0.6b';
    input('endpoint-key').value = 'sk-local';
    await save();
    expect(deps.requested).toEqual(['http://localhost/*']);
    expect(deps.stored.endpoint).toEqual({
      url: 'http://localhost:1234/v1',
      model: 'qwen3-0.6b',
      apiKey: 'sk-local',
      contextTokens: 8192,
    });
    expect(deps.stored.runtime).toBe('endpoint');
  });

  it('saves but warns when access to the endpoint is refused', async () => {
    const deps = fake();
    deps.granted = false;
    await startOptions(deps);
    input('rt-endpoint').checked = true;
    choose('endpoint-preset', '');
    input('endpoint-url').value = 'https://llm.example.com/v1';
    input('endpoint-model').value = 'm';
    await save();
    expect(deps.requested).toEqual(['https://llm.example.com/*']);
    expect(byId('options-status').textContent).toBe(
      'Saved, but WebAIAssist was not given access to https://llm.example.com, so the endpoint cannot be used.',
    );
  });

  it('refuses an endpoint over plain http to another computer, or without a model', async () => {
    const deps = fake();
    await startOptions(deps);
    input('rt-endpoint').checked = true;
    input('endpoint-url').value = 'http://192.168.1.9:8000/v1';
    input('endpoint-model').value = 'm';
    await save();
    expect(byId('options-status').textContent).toMatch(/^Not saved: Use https/);
    input('endpoint-url').value = 'http://localhost:11434/v1';
    input('endpoint-model').value = '';
    await save();
    expect(byId('options-status').textContent).toBe(
      'Not saved: give the model name at the endpoint.',
    );
    expect(deps.stored).toEqual(DEFAULT_SETTINGS);
    expect(deps.requested).toEqual([]);
  });

  it('resets to the defaults and clears the memory', async () => {
    const deps = fake({ ...DEFAULT_SETTINGS, maxSteps: 2, memory: false });
    await startOptions(deps);
    click('reset');
    for (let i = 0; i < 5; i += 1) await tick();
    expect(input('max-steps').value).toBe('6');
    expect(input('memory').checked).toBe(true);
    expect(byId('options-status').textContent).toBe('Options reset to the defaults.');
    click('clear-memory');
    await tick();
    expect(deps.cleared).toBe(1);
    expect(byId('options-status').textContent).toBe('Memory cleared.');
  });

  it('lists Gemma 4 E2B whether the graphics card has shader-f16, lacks it, or that is not known', async () => {
    const ids = (): string[] => [...select('webllm-model').options].map((o) => o.value);
    for (const shaderF16 of [false, true, undefined]) {
      loadPage('options.html');
      await startOptions({ ...fake(), shaderF16 });
      expect(ids()).toEqual([
        '',
        'qwen3-0.6b-q4_k_m',
        'qwen3-1.7b-q4_k_m',
        'qwen3.5-2b-q4_k_m',
        'llama-3.2-3b-instruct-q4_k_m',
        'gemma-4-e2b-it-q4_k_m',
      ]);
    }
  });
});
