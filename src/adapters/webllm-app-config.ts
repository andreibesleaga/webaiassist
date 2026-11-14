// SPDX-License-Identifier: Apache-2.0
// The model list WebLLM gets in the extension: only the four shipped models. Each model
// library (.wasm) is a file inside the package (copied in by scripts/model-libs.mjs) and is
// checked against its pinned SHA-256 before WebLLM runs it. The weights are data; they come
// from one fixed revision of the model's Hugging Face repository, and WebLLM also checks the
// model's config (mlc-chat-config.json) and tokenizer (tokenizer.json) of that revision
// against pinned SHA-256 values. WebLLM has no hash option for the weight shards, nor for the
// model manifest (mlc-model-manifest.json) that Gemma 4 E2B's record names: both are fetched from
// the pinned revision's address, which fixes their content, and are not hash-checked.
import pins from '../../scripts/model-libs.json';

/** The fields of WebLLM's ModelRecord that the extension sets. */
export interface BundledModelRecord {
  readonly model: string;
  readonly model_id: string;
  readonly model_lib: string;
  readonly vram_required_MB: number;
  readonly low_resource_required: boolean;
  /** Set only for a model whose package is described by a manifest file next to its weights. */
  readonly model_manifest?: string;
  readonly buffer_size_required_bytes?: number;
  /** WebGPU features the graphics card must have; WebLLM refuses to load the model without them. */
  readonly required_features?: readonly string[];
  readonly overrides: {
    readonly context_window_size: number;
    /** Models with a recurrent state (Qwen3.5) keep this many past turns in it. */
    readonly max_history_size?: number;
  };
  readonly integrity: {
    readonly model_lib: string;
    readonly config: string;
    readonly tokenizer: Readonly<Record<string, string>>;
    readonly onFailure: 'error';
  };
}

export interface BundledAppConfig {
  readonly model_list: readonly BundledModelRecord[];
}

export const LIBS_FOLDER = 'model-libs';
const CONTEXT_WINDOW = 4096;

interface Weights {
  readonly revision: string;
  readonly vram: number;
  /** SRI SHA-256 of mlc-chat-config.json and tokenizer.json at that revision. */
  readonly config: string;
  readonly tokenizer: string;
  /** The fields of WebLLM's own record for the model that are not the same for all models. */
  readonly record?: {
    readonly lowResource?: false;
    readonly manifest?: { readonly file: string; readonly bufferBytes: number };
    readonly requiredFeatures?: readonly string[];
    readonly maxHistory?: number;
  };
}

/**
 * Hugging Face revisions (commit ids) read on 12 Nov 2026, WebLLM 0.2.86's memory figures,
 * and the SHA-256 of the config and tokenizer files at each revision, computed on 12 Nov 2026
 * from the files downloaded from https://huggingface.co/mlc-ai/<model>/resolve/<revision>/.
 */
const WEIGHTS: Readonly<Record<string, Weights>> = {
  'Qwen3-0.6B-q4f16_1-MLC': {
    revision: '8c14ce481d4c692769976ad52afea453a102df19',
    vram: 1403.34,
    config: 'sha256-GQpRxWuaB6jYchJm+ORZvNGxaJvN/ylHlc0r/6ID/y0=',
    tokenizer: 'sha256-rrEzB6cazY/oGGHZStVKtonfdzMYgJ7tPL55S0SS2uQ=',
  },
  'Llama-3.2-3B-Instruct-q4f16_1-MLC': {
    revision: '1e80abf71e3d17cd564e2d2b63caa15cb226018e',
    vram: 2263.69,
    config: 'sha256-ELIxjYcTIMpmyGt6RMtETOp2d+B4obFH1OBkaViofb4=',
    tokenizer: 'sha256-eePlImNfMXEwCRO7QhRkqH3mIiGCoFcLmyzLoqlksrQ=',
  },
  // Read on 14 Nov 2026 from https://huggingface.co/api/models/mlc-ai/<model> (sha) and the files
  // at https://huggingface.co/mlc-ai/<model>/resolve/<revision>/. The fields in `record` are the
  // ones of WebLLM 0.2.86's own record (lib/index.js).
  'Qwen3.5-2B-q4f16_1-MLC': {
    revision: 'dd74e9c8a20c4546df85c844103bff87b6dcacad',
    vram: 2245.44,
    config: 'sha256-Q1d7bemkxizw/pxe5XvFLrsvxIfGSiG/eNYkMRhrSwE=',
    tokenizer: 'sha256-X55NSQGpK5l+RjwfRgVQiLbMpcphplItG59kxLuBy0I=',
    record: { lowResource: false, maxHistory: 1 },
  },
  'gemma-4-E2B-it-q4f16_1-MLC': {
    revision: '633df598b7a473759367855273c63912c9e2bc9a',
    vram: 3387.37,
    config: 'sha256-ffrJa4/Mq3SfiI/Oz5VA46E45sfnLfJiPfKAplplgCU=',
    tokenizer: 'sha256-zI06DONkZszBJ4v5h99fcdsXGbnKa0EYJk9Fy2J7/g8=',
    record: {
      lowResource: false,
      manifest: { file: 'mlc-model-manifest.json', bufferBytes: 201_326_592 },
      requiredFeatures: ['shader-f16'],
    },
  },
};

/** "sha256-<base64>" from 64 hex digits, the form WebLLM's integrity check reads. */
export function sriFromHex(hex: string): string {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`Not a SHA-256 in hex: "${hex}"`);
  const bytes = hex.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? [];
  return `sha256-${btoa(String.fromCharCode(...bytes))}`;
}

function record(
  lib: (typeof pins.libs)[number],
  getUrl: (path: string) => string,
): BundledModelRecord {
  const weights = WEIGHTS[lib.modelId];
  if (!weights) throw new Error(`No weights revision for ${lib.modelId}`);
  const extra = weights.record ?? {};
  return {
    model: `https://huggingface.co/mlc-ai/${lib.modelId}/resolve/${weights.revision}/`,
    model_id: lib.modelId,
    model_lib: getUrl(`${LIBS_FOLDER}/${lib.file}`),
    vram_required_MB: weights.vram,
    low_resource_required: extra.lowResource ?? true,
    ...(extra.manifest
      ? {
          model_manifest: extra.manifest.file,
          buffer_size_required_bytes: extra.manifest.bufferBytes,
        }
      : {}),
    ...(extra.requiredFeatures ? { required_features: extra.requiredFeatures } : {}),
    overrides: {
      context_window_size: CONTEXT_WINDOW,
      ...(extra.maxHistory === undefined ? {} : { max_history_size: extra.maxHistory }),
    },
    integrity: {
      model_lib: sriFromHex(lib.sha256),
      config: weights.config,
      tokenizer: { 'tokenizer.json': weights.tokenizer },
      onFailure: 'error' as const,
    },
  };
}

/** The app config for CreateMLCEngine; `getUrl` is chrome.runtime.getURL. */
export function bundledAppConfig(getUrl: (path: string) => string): BundledAppConfig {
  return { model_list: pins.libs.map((lib) => record(lib, getUrl)) };
}
