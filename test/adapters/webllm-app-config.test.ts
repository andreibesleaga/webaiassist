// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WEBLLM_MODEL_IDS } from '../../src/adapters/models';
import { bundledAppConfig, sriFromHex } from '../../src/adapters/webllm-app-config';
import pins from '../../scripts/model-libs.json';

const getUrl = (path: string): string => `chrome-extension://abc/${path}`;

describe('the WebLLM model list of the extension', () => {
  const config = bundledAppConfig(getUrl);

  it('has one record per shipped model, nothing else', () => {
    expect(config.model_list.map((r) => r.model_id)).toEqual([...WEBLLM_MODEL_IDS]);
  });

  it('loads every model library from inside the package, never from the network', () => {
    expect(config.model_list).toHaveLength(4);
    for (const record of config.model_list) {
      expect(record.model_lib).toMatch(/^chrome-extension:\/\/abc\/model-libs\/[\w.-]+\.wasm$/);
    }
  });

  it('checks each library against the pinned SHA-256 before WebLLM runs it', () => {
    expect(config.model_list).toHaveLength(4);
    for (const record of config.model_list) {
      const pin = pins.libs.find((lib) => lib.modelId === record.model_id);
      expect(pin).toBeDefined();
      expect(record.model_lib.endsWith(`/${pin?.file ?? '-'}`)).toBe(true);
      expect(record.integrity?.model_lib).toBe(sriFromHex(pin?.sha256 ?? ''));
      expect(record.integrity?.onFailure).toBe('error');
    }
  });

  it('downloads weights from a pinned revision of the model repository', () => {
    expect(config.model_list).toHaveLength(4);
    for (const record of config.model_list) {
      expect(record.model).toMatch(
        new RegExp(`^https://huggingface\\.co/mlc-ai/${record.model_id}/resolve/[0-9a-f]{40}/$`),
      );
    }
  });

  it('gives Qwen3.5 2B the single-turn state size and a full-memory flag WebLLM lists for it', () => {
    const record = config.model_list.find((r) => r.model_id === 'Qwen3.5-2B-q4f16_1-MLC');
    expect(record).toMatchObject({
      vram_required_MB: 2245.44,
      low_resource_required: false,
      overrides: { context_window_size: 4096, max_history_size: 1 },
    });
    expect(record).not.toHaveProperty('model_manifest');
    expect(record).not.toHaveProperty('required_features');
  });

  it('gives Gemma 4 E2B its manifest, buffer size and the shader-f16 requirement', () => {
    const record = config.model_list.find((r) => r.model_id === 'gemma-4-E2B-it-q4f16_1-MLC');
    expect(record).toMatchObject({
      vram_required_MB: 3387.37,
      low_resource_required: false,
      model_manifest: 'mlc-model-manifest.json',
      buffer_size_required_bytes: 201_326_592,
      required_features: ['shader-f16'],
      overrides: { context_window_size: 4096 },
    });
  });

  it('keeps the two first models as they were: low resource, no extra fields', () => {
    for (const id of ['Qwen3-0.6B-q4f16_1-MLC', 'Llama-3.2-3B-Instruct-q4f16_1-MLC']) {
      const record = config.model_list.find((r) => r.model_id === id);
      expect(record?.low_resource_required).toBe(true);
      expect(record).not.toHaveProperty('model_manifest');
      expect(record?.overrides).toEqual({ context_window_size: 4096 });
    }
  });

  it('pins the config and tokenizer of every model with a SHA-256 of its own', () => {
    const configs = config.model_list.map((r) => r.integrity.config);
    const tokenizers = config.model_list.map((r) => r.integrity.tokenizer['tokenizer.json']);
    expect(new Set(configs).size).toBe(4);
    expect(new Set(tokenizers).size).toBe(4);
  });

  it('keeps the context window of 4096 tokens that the adapter assumes', () => {
    expect(config.model_list).toHaveLength(4);
    for (const record of config.model_list) {
      expect(record.overrides?.context_window_size).toBe(4096);
    }
  });
});

describe('sriFromHex', () => {
  it('gives the Subresource Integrity form of a SHA-256', () => {
    const bytes = Buffer.from('webaiassist');
    const hex = createHash('sha256').update(bytes).digest('hex');
    const b64 = createHash('sha256').update(bytes).digest('base64');
    expect(sriFromHex(hex)).toBe(`sha256-${b64}`);
  });

  it('refuses a value that is not 64 hex digits', () => {
    expect(() => sriFromHex('abc')).toThrow(/SHA-256/);
  });

  it('matches the hash of the pinned file when it is present', () => {
    const lib = pins.libs[0];
    let bytes: Buffer | undefined;
    try {
      bytes = readFileSync(`vendor/model-libs/${lib?.file ?? '-'}`);
    } catch {
      return; // Not fetched yet; the build checks it.
    }
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(lib?.sha256);
  });
});
