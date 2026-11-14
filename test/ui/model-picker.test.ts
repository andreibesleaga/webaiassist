// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { findCpuModel } from '../../src/adapters/cpu-models';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import {
  groupLabel,
  pickerChoices,
  selectedValue,
  settingsFor,
  SETUP_VALUE,
} from '../../src/ui/model-picker';

const env = { promptApi: false, scripted: false };
const QWEN = 'Qwen3-0.6B-q4f16_1-MLC';
const LLAMA = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const QWEN35 = 'Qwen3.5-2B-q4f16_1-MLC';
const GEMMA = 'gemma-4-E2B-it-q4f16_1-MLC';

describe('model picker', () => {
  it('lists the four browser models, and more only when they can be used', () => {
    expect(pickerChoices(DEFAULT_SETTINGS, env).map((c) => c.value)).toEqual([
      `webllm:${QWEN}`,
      `webllm:${LLAMA}`,
      `webllm:${QWEN35}`,
      `webllm:${GEMMA}`,
    ]);
    const all = pickerChoices(
      {
        ...DEFAULT_SETTINGS,
        webllmModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        endpoint: {
          url: 'http://localhost:11434/v1',
          model: 'qwen3:0.6b',
          apiKey: '',
          contextTokens: 8192,
        },
      },
      { promptApi: true, scripted: true },
    );
    expect(all.map((c) => c.value)).toEqual([
      `webllm:${QWEN}`,
      `webllm:${LLAMA}`,
      `webllm:${QWEN35}`,
      `webllm:${GEMMA}`,
      'prompt-api',
      'scripted',
      'endpoint',
    ]);
    expect(all.find((c) => c.value === 'endpoint')?.label).toBe(
      'Endpoint: qwen3:0.6b at http://localhost:11434/v1 (your own server on this computer; nothing leaves it)',
    );
  });

  describe('says where each choice runs', () => {
    const withEndpoint = (url: string) => ({
      ...DEFAULT_SETTINGS,
      endpoint: { url, model: 'm', apiKey: '', contextTokens: 8192 },
    });
    const label = (value: string, url = 'http://localhost:11434/v1'): string =>
      pickerChoices(withEndpoint(url), { promptApi: true, scripted: false, cpu: true }).find(
        (c) => c.value === value,
      )?.label ?? '';

    it('puts the browser, processor and Chrome choices in one group and the endpoint in another', () => {
      const all = pickerChoices(withEndpoint('https://api.example.com/v1'), {
        promptApi: true,
        scripted: true,
        cpu: true,
      });
      const groups = all.map((c) => [c.runtime, c.group]);
      expect(new Set(groups.filter(([r]) => r !== 'endpoint').map(([, g]) => g))).toEqual(
        new Set(['local']),
      );
      expect(all.filter((c) => c.group === 'server').map((c) => c.runtime)).toEqual(['endpoint']);
      // The two groups are one run each, so the list can be drawn as two groups in order.
      expect(all.map((c) => c.group)).toEqual([...all.map((c) => c.group)].sort());
      expect([groupLabel('local'), groupLabel('server')]).toEqual([
        'On this computer, in the browser',
        'Your own server or a remote service',
      ]);
    });

    it('says "in this browser, on your graphics card" for every graphics-card model', () => {
      for (const id of [QWEN, LLAMA, QWEN35, GEMMA]) {
        expect(label(`webllm:${id}`)).toContain('in this browser, on your graphics card');
      }
    });

    it('says "in this browser, on your processor and memory" for every processor model', () => {
      for (const id of ['qwen3-0.6b-q4_k_m', 'qwen3-1.7b-q4_k_m', 'qwen3.5-2b-q4_k_m']) {
        expect(label(`cpu:${id}`)).toContain('in this browser, on your processor and memory');
      }
    });

    it('says Chrome runs its own model on this computer', () => {
      expect(label('prompt-api')).toContain('in Chrome on this computer');
    });

    it('says an address on this computer is your own server and nothing leaves it', () => {
      for (const url of ['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1']) {
        expect(label('endpoint', url)).toMatch(
          /\(your own server on this computer; nothing leaves it\)$/,
        );
      }
    });

    it('says any other address is remote and names the host the chat goes to', () => {
      expect(label('endpoint', 'https://api.example.com/v1')).toBe(
        'Endpoint: m at https://api.example.com/v1 (remote: your questions and the page content you use go to api.example.com)',
      );
    });
  });

  it('selects the small bundled model when WebGPU works, or the browser model chosen', () => {
    expect(selectedValue(DEFAULT_SETTINGS, env)).toBe(`webllm:${QWEN}`);
    expect(selectedValue(DEFAULT_SETTINGS, { ...env, webgpu: true })).toBe(`webllm:${QWEN}`);
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'webllm' as const, webllmModel: LLAMA };
    expect(selectedValue(chosen, env)).toBe(`webllm:${LLAMA}`);
    expect(selectedValue({ ...chosen, webllmModel: '' }, env)).toBe(`webllm:${QWEN}`);
  });

  it('keeps the model the user chose, whatever the default would be', () => {
    const ready = { ...env, promptApi: true, builtIn: 'available' as const, cpu: true };
    expect(selectedValue(DEFAULT_SETTINGS, ready)).toBe('prompt-api');
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'webllm' as const, webllmModel: LLAMA };
    expect(selectedValue(chosen, ready)).toBe(`webllm:${LLAMA}`);
    const cpu = { ...DEFAULT_SETTINGS, runtime: 'cpu' as const, cpuModel: 'qwen3-1.7b-q4_k_m' };
    expect(selectedValue(cpu, ready)).toBe('cpu:qwen3-1.7b-q4_k_m');
  });

  it('puts the processor model first by default when this browser can run it', () => {
    expect(selectedValue(DEFAULT_SETTINGS, { ...env, cpu: true })).toBe('cpu:qwen3-0.6b-q4_k_m');
  });

  it('never selects Chrome’s built-in model or the endpoint by itself when WebGPU works', () => {
    const all = { promptApi: true, scripted: false, webgpu: true };
    const withEndpoint = {
      ...DEFAULT_SETTINGS,
      endpoint: { ...DEFAULT_SETTINGS.endpoint, model: 'qwen3:0.6b' },
    };
    expect(selectedValue(DEFAULT_SETTINGS, all)).toBe(`webllm:${QWEN}`);
    expect(selectedValue(withEndpoint, all)).toBe(`webllm:${QWEN}`);
  });

  it('without WebGPU, falls back to Chrome’s built-in model, then the endpoint, then its set-up', () => {
    const noGpu = { promptApi: false, scripted: false, webgpu: false };
    expect(selectedValue(DEFAULT_SETTINGS, { ...noGpu, promptApi: true })).toBe('prompt-api');
    const withEndpoint = {
      ...DEFAULT_SETTINGS,
      endpoint: { ...DEFAULT_SETTINGS.endpoint, model: 'qwen3:0.6b' },
    };
    expect(selectedValue(withEndpoint, noGpu)).toBe('endpoint');
    expect(selectedValue(DEFAULT_SETTINGS, noGpu)).toBe(SETUP_VALUE);
    const choices = pickerChoices(DEFAULT_SETTINGS, noGpu);
    expect(choices.at(-1)).toMatchObject({ value: SETUP_VALUE, runtime: 'setup' });
    expect(
      pickerChoices(DEFAULT_SETTINGS, { ...noGpu, webgpu: true }).map((c) => c.value),
    ).not.toContain(SETUP_VALUE);
  });

  it('falls back to the browser model when the chosen runtime cannot be used', () => {
    expect(selectedValue({ ...DEFAULT_SETTINGS, runtime: 'prompt-api' }, env)).toBe(
      `webllm:${QWEN}`,
    );
    expect(selectedValue({ ...DEFAULT_SETTINGS, runtime: 'endpoint' }, env)).toBe(`webllm:${QWEN}`);
    expect(
      selectedValue({ ...DEFAULT_SETTINGS, runtime: 'prompt-api' }, { ...env, promptApi: true }),
    ).toBe('prompt-api');
  });

  it('turns a choice in the panel into settings', () => {
    expect(settingsFor(DEFAULT_SETTINGS, `webllm:${LLAMA}`)).toMatchObject({
      runtime: 'webllm',
      webllmModel: LLAMA,
    });
    expect(settingsFor(DEFAULT_SETTINGS, 'endpoint').runtime).toBe('endpoint');
    expect(settingsFor(DEFAULT_SETTINGS, 'prompt-api').runtime).toBe('prompt-api');
    expect(settingsFor(DEFAULT_SETTINGS, 'scripted')).toEqual(DEFAULT_SETTINGS);
    expect(settingsFor(DEFAULT_SETTINGS, SETUP_VALUE)).toEqual(DEFAULT_SETTINGS);
  });

  it('lists the processor models after the graphics-card ones, only when this browser can run them', () => {
    const cpu = pickerChoices(DEFAULT_SETTINGS, { ...env, cpu: true });
    expect(cpu.map((c) => c.value)).toEqual([
      `webllm:${QWEN}`,
      `webllm:${LLAMA}`,
      `webllm:${QWEN35}`,
      `webllm:${GEMMA}`,
      'cpu:qwen3-0.6b-q4_k_m',
      'cpu:qwen3-1.7b-q4_k_m',
      'cpu:qwen3.5-2b-q4_k_m',
    ]);
    expect(cpu[4]).toMatchObject({ runtime: 'cpu', modelId: 'qwen3-0.6b-q4_k_m' });
    expect(cpu[4]?.label).toMatch(/397 MB/);
    expect(pickerChoices(DEFAULT_SETTINGS, { ...env, cpu: false })).toHaveLength(4);
  });

  it('adds the test models of the smoke build and keeps a chosen one', () => {
    const extra = [{ ...findCpuModel('qwen3-0.6b-q4_k_m')!, id: 'smoke-cpu', label: 'Smoke CPU' }];
    const all = pickerChoices(DEFAULT_SETTINGS, { ...env, cpu: true, extraCpuModels: extra });
    expect(all.map((c) => c.value)).toContain('cpu:smoke-cpu');
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'cpu' as const, cpuModel: 'smoke-cpu' };
    expect(selectedValue(chosen, { ...env, cpu: true, extraCpuModels: extra })).toBe(
      'cpu:smoke-cpu',
    );
    expect(selectedValue(chosen, { ...env, cpu: true })).toBe('cpu:qwen3-0.6b-q4_k_m');
  });

  it('selects and saves a processor model', () => {
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'cpu' as const, cpuModel: 'qwen3-1.7b-q4_k_m' };
    expect(selectedValue(chosen, { ...env, cpu: true })).toBe('cpu:qwen3-1.7b-q4_k_m');
    expect(selectedValue({ ...chosen, cpuModel: '' }, { ...env, cpu: true })).toBe(
      'cpu:qwen3-0.6b-q4_k_m',
    );
    expect(selectedValue({ ...chosen, cpuModel: 'unknown' }, { ...env, cpu: true })).toBe(
      'cpu:qwen3-0.6b-q4_k_m',
    );
    expect(selectedValue(chosen, env)).toBe(`webllm:${QWEN}`);
    expect(settingsFor(DEFAULT_SETTINGS, 'cpu:qwen3-1.7b-q4_k_m')).toMatchObject({
      runtime: 'cpu',
      cpuModel: 'qwen3-1.7b-q4_k_m',
    });
  });
});

describe('Gemma 4 E2B needs the shader-f16 feature of the graphics card', () => {
  const values = (e: object): string[] =>
    pickerChoices(DEFAULT_SETTINGS, { ...env, ...e }).map((c) => c.value);

  it('is listed when the adapter reports shader-f16, or when that is not known yet', () => {
    expect(values({ shaderF16: true })).toContain(`webllm:${GEMMA}`);
    expect(values({})).toContain(`webllm:${GEMMA}`);
  });

  it('is not listed when the adapter lacks shader-f16; the other three stay', () => {
    expect(values({ shaderF16: false })).toEqual([
      `webllm:${QWEN}`,
      `webllm:${LLAMA}`,
      `webllm:${QWEN35}`,
    ]);
  });

  it('is not kept selected when it was chosen on a computer that lacks the feature', () => {
    const chosen = { ...DEFAULT_SETTINGS, runtime: 'webllm' as const, webllmModel: GEMMA };
    expect(selectedValue(chosen, { ...env, shaderF16: true })).toBe(`webllm:${GEMMA}`);
    expect(selectedValue(chosen, { ...env, shaderF16: false })).toBe(`webllm:${QWEN}`);
  });

  it('is never the default, and neither is Qwen3.5 2B', () => {
    for (const shaderF16 of [true, false, undefined]) {
      const picked = selectedValue(DEFAULT_SETTINGS, { ...env, webgpu: true, shaderF16 });
      expect(picked).toBe(`webllm:${QWEN}`);
    }
  });
});
