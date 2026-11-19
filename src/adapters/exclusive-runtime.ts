// SPDX-License-Identifier: Apache-2.0
// The offscreen document hosts two runtimes (llama.cpp on the graphics card and llama.cpp on
// the processor). Loading one lets the other go first, so a model chosen in the panel never
// sits in memory next to the one it replaced.
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
} from '../core/ports/model-runtime';
import type { CancelSignal } from '../core/types';

export class ExclusiveRuntime implements ModelRuntime {
  constructor(
    private readonly inner: ModelRuntime,
    private readonly others: () => readonly ModelRuntime[],
  ) {}

  async load(
    modelId: string,
    onProgress: (progress: LoadProgress) => void,
    signal?: CancelSignal,
  ): Promise<void> {
    await Promise.all(this.others().map((other) => other.unload()));
    return this.inner.load(modelId, onProgress, signal);
  }

  chat(request: ChatRequest): Promise<string> {
    return this.inner.chat(request);
  }

  unload(): Promise<void> {
    return this.inner.unload();
  }

  capabilities(): ModelCapabilities {
    return this.inner.capabilities();
  }

  where(): string | undefined {
    return this.inner.where?.();
  }
}
