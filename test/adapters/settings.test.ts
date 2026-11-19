// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { LEGACY_GPU_IDS } from '../../src/adapters/cpu-models';
import {
  DEFAULT_SETTINGS,
  ENDPOINT_PRESETS,
  loadSettings,
  normalizeSettings,
  resetSettings,
  saveSettings,
  SETTINGS_KEY,
  type StorageAreaLike,
} from '../../src/adapters/settings';

class MemoryArea implements StorageAreaLike {
  readonly data: Record<string, unknown> = {};
  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve(key in this.data ? { [key]: this.data[key] } : {});
  }
  set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, JSON.parse(JSON.stringify(items)));
    return Promise.resolve();
  }
  remove(key: string): Promise<void> {
    delete this.data[key];
    return Promise.resolve();
  }
}

describe('settings', () => {
  it('has safe defaults: automatic runtime, automatic model, ask every call, step cap 6, memory on', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      version: 3,
      runtime: 'auto',
      webllmModel: '',
      cpuModel: '',
      endpoint: { url: 'http://localhost:11434/v1', model: '', apiKey: '', contextTokens: 8192 },
      maxSteps: 6,
      confirmMode: 'every-call',
      memory: true,
      siteFacts: true,
      language: 'en',
    });
  });

  it('keeps the site-facts choice and falls back to on for a value it does not know', () => {
    expect(normalizeSettings({ siteFacts: false }).siteFacts).toBe(false);
    expect(normalizeSettings({ siteFacts: 'no' }).siteFacts).toBe(true);
    expect(normalizeSettings({}).siteFacts).toBe(true);
  });

  it('offers Ollama, LM Studio and OpenRouter as endpoint presets', () => {
    expect(ENDPOINT_PRESETS.map((p) => p.url)).toEqual([
      'http://localhost:11434/v1',
      'http://localhost:1234/v1',
      'https://openrouter.ai/api/v1',
    ]);
  });

  it('fills missing fields and replaces values it does not know', () => {
    const settings = normalizeSettings({
      version: 3,
      runtime: 'cloud',
      maxSteps: 99,
      confirmMode: 'never',
      memory: 'yes',
      language: 'xx',
      endpoint: { url: 5, model: 'llama3', apiKey: 'k' },
      extra: true,
    });
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      maxSteps: 12,
      endpoint: {
        url: DEFAULT_SETTINGS.endpoint.url,
        model: 'llama3',
        apiKey: 'k',
        contextTokens: 8192,
      },
    });
  });

  it('clamps the endpoint context window to 1024..1000000 tokens', () => {
    const at = (contextTokens: unknown) =>
      normalizeSettings({ endpoint: { contextTokens } }).endpoint.contextTokens;
    expect(at(10)).toBe(1024);
    expect(at(2e9)).toBe(1_000_000);
    expect(at(32768.4)).toBe(32768);
    expect(at('big')).toBe(8192);
  });

  it('clamps the step cap to 1..12 and rounds it', () => {
    expect(normalizeSettings({ maxSteps: 0 }).maxSteps).toBe(1);
    expect(normalizeSettings({ maxSteps: 3.6 }).maxSteps).toBe(4);
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid choices', () => {
    const chosen = {
      ...DEFAULT_SETTINGS,
      runtime: 'endpoint',
      webllmModel: 'llama-3.2-3b-instruct-q4_k_m',
      confirmMode: 'per-site',
      memory: false,
    };
    expect(normalizeSettings(chosen)).toEqual(chosen);
  });

  it('keeps Chrome’s built-in model when it was chosen with this version', () => {
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'prompt-api' };
    expect(normalizeSettings(chosen).runtime).toBe('prompt-api');
  });

  it('drops Chrome’s built-in model saved by 0.1.0 before this fix, once, and keeps the rest', () => {
    const old = { ...DEFAULT_SETTINGS, version: 1, runtime: 'prompt-api', maxSteps: 4 };
    expect(normalizeSettings(old)).toMatchObject({ version: 3, runtime: 'auto', maxSteps: 4 });
    const endpoint = { ...DEFAULT_SETTINGS, version: 1, runtime: 'endpoint' };
    expect(normalizeSettings(endpoint).runtime).toBe('endpoint');
  });

  it('reads the stored default of version 2 ("webllm" with no model named) as automatic', () => {
    const stored = { ...DEFAULT_SETTINGS, version: 2, runtime: 'webllm', webllmModel: '' };
    expect(normalizeSettings(stored).runtime).toBe('auto');
  });

  it('keeps what version 2 stored as a choice: a named graphics-card model, the processor, an endpoint', () => {
    const named = {
      ...DEFAULT_SETTINGS,
      version: 2,
      runtime: 'webllm',
      webllmModel: 'llama-3.2-3b-instruct-q4_k_m',
    };
    expect(normalizeSettings(named).runtime).toBe('webllm');
    for (const runtime of ['cpu', 'endpoint', 'prompt-api']) {
      expect(normalizeSettings({ ...DEFAULT_SETTINGS, version: 2, runtime }).runtime).toBe(runtime);
    }
  });

  it('turns a browser model that is not shipped into "automatic"', () => {
    const old = { ...DEFAULT_SETTINGS, webllmModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC' };
    expect(normalizeSettings(old).webllmModel).toBe('');
  });

  it('reads each model id that version 0.1.0 saved as its new id, keeping the graphics-card choice', () => {
    for (const [oldId, newId] of Object.entries(LEGACY_GPU_IDS)) {
      const old = { ...DEFAULT_SETTINGS, version: 2, runtime: 'webllm', webllmModel: oldId };
      expect(normalizeSettings(old)).toMatchObject({ runtime: 'webllm', webllmModel: newId });
    }
    expect(Object.keys(LEGACY_GPU_IDS)).toHaveLength(4);
    expect(LEGACY_GPU_IDS['Qwen3-0.6B-q4f16_1-MLC']).toBe('qwen3-0.6b-q4_k_m');
    expect(LEGACY_GPU_IDS['Qwen3.5-2B-q4f16_1-MLC']).toBe('qwen3.5-2b-q4_k_m');
    expect(LEGACY_GPU_IDS['Llama-3.2-3B-Instruct-q4f16_1-MLC']).toBe(
      'llama-3.2-3b-instruct-q4_k_m',
    );
    expect(LEGACY_GPU_IDS['gemma-4-E2B-it-q4f16_1-MLC']).toBe('gemma-4-e2b-it-q4_k_m');
  });

  it('saves, loads and resets through chrome.storage.local', async () => {
    const area = new MemoryArea();
    expect(await loadSettings(area)).toEqual(DEFAULT_SETTINGS);
    const saved = await saveSettings(area, { ...DEFAULT_SETTINGS, maxSteps: 3 });
    expect(saved.maxSteps).toBe(3);
    expect(area.data[SETTINGS_KEY]).toEqual(saved);
    expect((await loadSettings(area)).maxSteps).toBe(3);
    await resetSettings(area);
    expect(area.data[SETTINGS_KEY]).toBeUndefined();
    expect(await loadSettings(area)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps the processor model choice and drops one that is not a plain id', () => {
    const kept = normalizeSettings({ runtime: 'cpu', cpuModel: 'qwen3-1.7b-q4_k_m' });
    expect(kept).toMatchObject({ runtime: 'cpu', cpuModel: 'qwen3-1.7b-q4_k_m' });
    expect(normalizeSettings({ runtime: 'cpu', cpuModel: '../x y' }).cpuModel).toBe('');
    expect(normalizeSettings({ runtime: 'cpu', cpuModel: 7 }).cpuModel).toBe('');
    expect(normalizeSettings({ runtime: 'cpu' })).toMatchObject({ runtime: 'cpu', cpuModel: '' });
  });
});
