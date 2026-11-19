// SPDX-License-Identifier: Apache-2.0
// The models the local runtime (llama.cpp in WebAssembly, src/adapters/wllama-runtime.ts) loads,
// on the processor or on the graphics card. Each one is a GGUF file at a fixed Hugging Face
// commit with its size and SHA-256 (the file's LFS object id, read on 13 Nov 2026; the two files
// offered only on the graphics card on 18 Nov 2026); the runtime refuses and deletes a download
// that differs. The weights are data, downloaded on the user's click, never shipped inside the
// package. A model offered both ways is one file: it downloads once.
import type { ModelCapabilities } from '../core/ports/model-runtime';

export interface CpuModel {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly licence: string;
  /** Memory the model needs in megabytes (file, key-value cache and buffers): free memory on the
   *  processor, graphics memory on the graphics card. */
  readonly memoryMb: number;
  /** The chat template has an "enable_thinking" switch (Qwen3): turned off. */
  readonly thinkingSwitch: boolean;
  /** Only for a file above ONE_DIGEST_MAX: the SHA-256 of each consecutive piece of PART_BYTES
   *  (the last one shorter), computed from the file whose whole SHA-256 is `sha256`. The browser's
   *  SHA-256 takes one buffer of at most 2 GiB, so such a file is checked piece by piece. */
  readonly parts?: readonly string[];
}

/** The largest file the browser hashes in one call (an ArrayBuffer of 2 GiB less one byte). */
export const ONE_DIGEST_MAX = 2 ** 31 - 1;
/** The piece size of `parts`: 1 GiB. */
export const PART_BYTES = 1024 ** 3;

/** The context window every CPU model is loaded with; the saved chat is kept inside it. */
export const CPU_CONTEXT_TOKENS = 4096;

/** What the panel and the agent loop know about the CPU runtime. Its replies follow the JSON
 *  schema the loop passes (llama.cpp turns it into a grammar). The panel needs this before the
 *  host answers, so it lives here and not in the adapter that runs in the host. */
export const CPU_CAPABILITIES: ModelCapabilities = {
  nativeToolCalls: false,
  jsonConstraint: true,
  contextTokens: CPU_CONTEXT_TOKENS,
  // Measured 18 Nov 2026: with the built-in graph tool beside a node's ten tools, Qwen3 1.7B chose it
  // for 4 of 10 live-node questions that a page tool answers (docs/EVAL.md).
  pageToolsFirst: true,
};

/** Where a processor model runs, as every label says it. */
const ON_CPU = 'in this browser, on your processor and memory';

const SMALL: CpuModel = {
  id: 'qwen3-0.6b-q4_k_m',
  label: `Qwen3 0.6B on the processor (small; ${ON_CPU}; 397 MB download; needs about 0.8 GB of memory; Apache-2.0)`,
  url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf',
  bytes: 396_705_472,
  sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
  licence: 'Apache-2.0',
  memoryMb: 800,
  thinkingSwitch: true,
};

const LARGE: CpuModel = {
  id: 'qwen3-1.7b-q4_k_m',
  label: `Qwen3 1.7B on the processor (better answers; ${ON_CPU}; 1.1 GB download; needs about 1.5 GB of memory; Apache-2.0)`,
  url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/d7f544eead698dbd1f15126ef60b45a1e1933222/Qwen3-1.7B-Q4_K_M.gguf',
  bytes: 1_107_409_472,
  sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
  licence: 'Apache-2.0',
  memoryMb: 1500,
  thinkingSwitch: true,
};

// Read from Hugging Face on 14 Nov 2026: the repository's tree at its newest commit
// (https://huggingface.co/api/models/unsloth/Qwen3.5-2B-GGUF/tree/<commit>), the file's size and
// its LFS object id; the model card says "license: apache-2.0".
const NEWER: CpuModel = {
  id: 'qwen3.5-2b-q4_k_m',
  label: `Qwen3.5 2B on the processor (newer, for tools, slower than Qwen3 1.7B; ${ON_CPU}; 1.3 GB download; needs about 1.7 GB of memory; Apache-2.0)`,
  url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/f6d5376be1edb4d416d56da11e5397a961aca8ae/Qwen3.5-2B-Q4_K_M.gguf',
  bytes: 1_280_835_840,
  sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
  licence: 'Apache-2.0',
  memoryMb: 1700,
  thinkingSwitch: true,
};

/** Where a graphics-card model runs, as every label says it. */
const ON_GPU = 'in this browser, on your graphics card';

/** The same file as on the processor, offered on the graphics card under its own label. */
const onGpu = (model: CpuModel, label: string): CpuModel => ({ ...model, label });

// Read from Hugging Face on 18 Nov 2026 (tree of the newest commit; size and LFS object id).
// The model card says "license: llama3.2" (the Llama 3.2 Community License).
const LLAMA: CpuModel = {
  id: 'llama-3.2-3b-instruct-q4_k_m',
  label: `Llama 3.2 3B (larger, picks tools well; ${ON_GPU}; 2.0 GB download; needs about 2.4 GB of GPU memory; Llama 3.2 Community License)`,
  url: 'https://huggingface.co/unsloth/Llama-3.2-3B-Instruct-GGUF/resolve/e7d0997e49c9cb00d88b4c1a6a16aa894b0bbc31/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  bytes: 2_019_377_600,
  sha256: '6c99cc00ae910f6a532a80022cb4bc1939094527a089c29294b841c0bd87f74d',
  licence: 'Llama 3.2 Community License',
  memoryMb: 2400,
  thinkingSwitch: false,
};

// Read the same way on 18 Nov 2026; the model card says "license: apache-2.0".
const GEMMA: CpuModel = {
  id: 'gemma-4-e2b-it-q4_k_m',
  label: `Gemma 4 E2B (slow: may stall on a laptop graphics card; ${ON_GPU}; 3.1 GB download; needs about 3.5 GB of GPU memory; Apache-2.0)`,
  url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/0314792d7f1f7e229411f620751375812bb9faf2/gemma-4-E2B-it-Q4_K_M.gguf',
  bytes: 3_106_738_272,
  sha256: '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8',
  licence: 'Apache-2.0',
  memoryMb: 3500,
  thinkingSwitch: false,
  // Computed on 18 Nov 2026 from a download whose whole SHA-256 was the one above.
  parts: [
    '3576b44e23c92f0753f0581d614acf63f5110925881ec35acb161e0cbaa692d8',
    'd78c2ee565e8b3367546815a0a661f34943a7eee80037dbddfcd51e1febf4253',
    'e70158e776868af8f0fda5139ade2ed2339f59f8092515444543a33d54aa5a62',
  ],
};

const GPU_SMALL = onGpu(
  SMALL,
  `Qwen3 0.6B (the smallest; ${ON_GPU}; 397 MB download; needs about 0.7 GB of GPU memory; Apache-2.0)`,
);
const GPU_LARGE = onGpu(
  LARGE,
  `Qwen3 1.7B (better answers; ${ON_GPU}; 1.1 GB download; needs about 1.4 GB of GPU memory; Apache-2.0)`,
);
const GPU_NEWER = onGpu(
  NEWER,
  `Qwen3.5 2B (newer, for tools; ${ON_GPU}; 1.3 GB download; needs about 1.6 GB of GPU memory; Apache-2.0)`,
);

export const CPU_MODELS: readonly CpuModel[] = [SMALL, LARGE, NEWER];
/** The same engine with every layer on the graphics card (WebGPU). */
export const GPU_MODELS: readonly CpuModel[] = [GPU_SMALL, GPU_LARGE, GPU_NEWER, LLAMA, GEMMA];
/** Every model file the extension can store, once each. */
export const LOCAL_FILES: readonly CpuModel[] = [SMALL, LARGE, NEWER, LLAMA, GEMMA];
export const GPU_MODEL_IDS: readonly string[] = GPU_MODELS.map((m) => m.id);

/** The ids version 0.1.0 stored for the graphics-card models (files of another engine), and the
 *  model each one is now. A saved choice keeps pointing at the same model. */
export const LEGACY_GPU_IDS: Readonly<Record<string, string>> = {
  'Qwen3-0.6B-q4f16_1-MLC': SMALL.id,
  'Qwen3.5-2B-q4f16_1-MLC': NEWER.id,
  'Llama-3.2-3B-Instruct-q4f16_1-MLC': LLAMA.id,
  'gemma-4-E2B-it-q4f16_1-MLC': GEMMA.id,
};

/** The graphics-card model "Start" loads when the user has not picked one: Qwen3 1.7B, which
 *  picked the right tool in 9 of 10 test-node questions and 4 of 10 on the live node, where Qwen3
 *  0.6B picked it in 2 of 10 and 1 of 10 (18 Nov 2026, NVIDIA, docs/EVAL.md). */
export function defaultGpuModelId(): string {
  return LARGE.id;
}

/** A graphics-card model by id; `extra` as in findCpuModel. */
export function findGpuModel(id: string, extra: readonly CpuModel[] = []): CpuModel | undefined {
  return [...GPU_MODELS, ...extra].find((m) => m.id === id);
}
export const CPU_MODEL_IDS: readonly string[] = CPU_MODELS.map((m) => m.id);

/** The model "Start" loads on the processor when the user has not picked one. */
export function defaultCpuModelId(): string {
  return LARGE.id;
}

/** A listed model by id; `extra` is for builds that add test models (the smoke-test build). */
export function findCpuModel(id: string, extra: readonly CpuModel[] = []): CpuModel | undefined {
  return [...CPU_MODELS, ...extra].find((m) => m.id === id);
}
