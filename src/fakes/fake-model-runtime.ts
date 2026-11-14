// SPDX-License-Identifier: Apache-2.0
import type {
  ChatRequest,
  LoadProgress,
  ModelCapabilities,
  ModelRuntime,
} from '../core/ports/model-runtime';

/** A model that returns scripted replies in order. Records every request. */
export class FakeModelRuntime implements ModelRuntime {
  readonly requests: ChatRequest[] = [];
  loadedModel: string | undefined;
  private readonly replies: string[];

  constructor(replies: readonly string[]) {
    this.replies = [...replies];
  }

  load(modelId: string, onProgress: (progress: LoadProgress) => void): Promise<void> {
    onProgress({ fraction: 1, text: `loaded ${modelId}` });
    this.loadedModel = modelId;
    return Promise.resolve();
  }

  chat(request: ChatRequest): Promise<string> {
    this.requests.push({ ...request, messages: [...request.messages] });
    const reply = this.replies.length > 1 ? this.replies.shift() : this.replies[0];
    if (reply === undefined) return Promise.reject(new Error('FakeModelRuntime: no reply'));
    request.onToken?.(reply);
    return Promise.resolve(reply);
  }

  unload(): Promise<void> {
    this.loadedModel = undefined;
    return Promise.resolve();
  }

  capabilities(): ModelCapabilities {
    return { nativeToolCalls: false, jsonConstraint: true, contextTokens: 4096 };
  }
}
