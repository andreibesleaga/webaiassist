// SPDX-License-Identifier: Apache-2.0
// Measures how long the first answer after a load takes to start: from the first chat call to
// its first token. On a graphics card the first answer also compiles the GPU programs, which took
// about 40 s on the owner's laptop (src/adapters/gpu-speed.ts decides what is slow). Only the
// first chat is timed; a chat that fails before any token reports nothing.
import type { ChatRequest, ModelRuntime } from '../core/ports/model-runtime';

export function timeFirstToken(
  model: ModelRuntime,
  now: () => number,
  onFirst: (ms: number) => void,
): ModelRuntime {
  let pending = true;
  return {
    load: (id, onProgress, signal) => model.load(id, onProgress, signal),
    unload: () => model.unload(),
    capabilities: () => model.capabilities(),
    where: () => model.where?.(),
    chat(request: ChatRequest): Promise<string> {
      if (!pending) return model.chat(request);
      const start = now();
      const onToken = (token: string): void => {
        if (pending) {
          pending = false;
          onFirst(now() - start);
        }
        request.onToken?.(token);
      };
      return model.chat({ ...request, onToken });
    },
  };
}
