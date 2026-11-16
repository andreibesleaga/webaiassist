// SPDX-License-Identifier: Apache-2.0
// The models the CPU runtime (llama.cpp in WebAssembly, src/adapters/wllama-runtime.ts) loads.
// Each one is a GGUF file at a fixed Hugging Face commit with its size and SHA-256 (the file's
// LFS object id, read on 13 Nov 2026); the runtime refuses and deletes a download that differs.
// The weights are data, downloaded on the user's click, never shipped inside the package.
import type { ModelCapabilities } from '../core/ports/model-runtime';

export interface CpuModel {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly licence: string;
  /** Free memory the model needs in megabytes (file, key-value cache and buffers). */
  readonly memoryMb: number;
  /** The chat template has an "enable_thinking" switch (Qwen3): turned off. */
  readonly thinkingSwitch: boolean;
}

/** The context window every CPU model is loaded with; the saved chat is kept inside it. */
export const CPU_CONTEXT_TOKENS = 4096;

/** What the panel and the agent loop know about the CPU runtime. Its replies follow the JSON
 *  schema the loop passes (llama.cpp turns it into a grammar). The panel needs this before the
 *  host answers, so it lives here and not in the adapter that runs in the host. */
export const CPU_CAPABILITIES: ModelCapabilities = {
  nativeToolCalls: false,
  jsonConstraint: true,
  contextTokens: CPU_CONTEXT_TOKENS,
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

export const CPU_MODELS: readonly CpuModel[] = [SMALL, LARGE, NEWER];
export const CPU_MODEL_IDS: readonly string[] = CPU_MODELS.map((m) => m.id);

/** The model "Start" loads on the processor when the user has not picked one. */
export function defaultCpuModelId(): string {
  return LARGE.id;
}

/** A listed model by id; `extra` is for builds that add test models (the smoke-test build). */
export function findCpuModel(id: string, extra: readonly CpuModel[] = []): CpuModel | undefined {
  return [...CPU_MODELS, ...extra].find((m) => m.id === id);
}
