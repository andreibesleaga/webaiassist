// SPDX-License-Identifier: Apache-2.0
// The real llama.cpp engine (@wllama/wllama), created inside the offscreen document. The
// WebAssembly file is read from inside the package (model-libs/wllama.wasm, hash-checked at
// build time); wllama starts its own Worker from the package's own code. The weights live in
// wllama's cache in the extension's private file storage. It never calls setCompat, so the
// remote compatibility build is never used (its address is removed from the bundle).
import { Wllama, type CacheEntryMetadata, type CacheManager } from '@wllama/wllama/esm/index.js';
import type {
  WllamaChatRequest,
  WllamaEngineLike,
  WllamaFactory,
} from '../../adapters/wllama-runtime';

const WASM_FILE = 'model-libs/wllama.wasm';
/** Where the runtime records that it checked a stored file, inside wllama's own metadata. */
const CHECKED_KEY = 'webaiassistCheckedSha256';
/** Qwen's recommended settings for replies without reasoning text. */
const SAMPLING = { temperature: 0.7, top_p: 0.8, top_k: 20 } as const;
const MAX_REPLY_TOKENS = 768;

type Checked = CacheEntryMetadata & { [CHECKED_KEY]?: string };

interface Timings {
  prompt_n: number;
  prompt_ms: number;
  prompt_per_second: number;
  predicted_n: number;
  predicted_ms: number;
  predicted_per_second: number;
}
interface Chunk {
  choices: { delta: { content?: string | null } }[];
  timings?: Timings;
}

export const sha256OfBlob = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** The measuring builds only (smoke, eval): the speed of the prompt and of the reply of each
 *  answer, kept in localStorage, which every page of the extension shares, for `npm run
 *  eval:cpu` to read. The release build never writes it. */
export const TIMINGS_KEY = 'webaiassist.cpu-timings';

function recordTimings(timings: Timings): void {
  try {
    const kept = JSON.parse(localStorage.getItem(TIMINGS_KEY) ?? '[]') as Timings[];
    localStorage.setItem(TIMINGS_KEY, JSON.stringify([...kept, timings].slice(-100)));
  } catch {
    // Storage refused: the eval then reports no speed.
  }
}

class WllamaEngine implements WllamaEngineLike {
  private readonly wllama = new Wllama(
    { default: chrome.runtime.getURL(WASM_FILE) },
    { suppressNativeLog: true, allowOffline: true },
  );

  private name(url: string): Promise<string> {
    return this.wllama.cacheManager.getNameFromURL(url);
  }

  async storedBytes(url: string): Promise<number> {
    return this.wllama.cacheManager.getSize(await this.name(url));
  }

  download(
    url: string,
    onProgress: (loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.wllama.cacheManager.download(url, {
      progressCallback: ({ loaded, total }) => onProgress(loaded, total),
      ...(signal ? { signal } : {}),
    });
  }

  async sha256(url: string): Promise<string> {
    const blob = await this.wllama.cacheManager.open(url);
    if (!blob) throw new Error('The stored file is missing.');
    return sha256OfBlob(blob);
  }

  remove(url: string): Promise<void> {
    return this.wllama.cacheManager.delete(url);
  }

  async isChecked(url: string, sha256: string): Promise<boolean> {
    const meta: Checked | null = await this.wllama.cacheManager.getMetadata(await this.name(url));
    return meta?.[CHECKED_KEY] === sha256;
  }

  async markChecked(url: string, sha256: string): Promise<void> {
    const name = await this.name(url);
    const meta = await this.wllama.cacheManager.getMetadata(name);
    if (!meta) throw new Error('The stored file has no record to mark.');
    const marked: Checked = { ...meta, [CHECKED_KEY]: sha256 };
    await this.wllama.cacheManager.writeMetadata(name, marked);
  }

  /** Loads from the stored copy only; a missing copy is an error, never a second download. */
  async load(url: string, contextTokens: number): Promise<void> {
    const blob = await this.wllama.cacheManager.open(url);
    if (!blob)
      throw new Error('The stored model file is missing. Press Start to download it again.');
    await this.wllama.loadModel([blob], {
      n_ctx: contextTokens,
      n_gpu_layers: 0,
      flash_attn: true,
      cache_type_k: 'q8_0',
      cache_type_v: 'q8_0',
      jinja: true,
    });
  }

  async chat(request: WllamaChatRequest): Promise<AsyncIterable<string>> {
    const chunks = await this.wllama.createChatCompletion({
      messages: request.messages,
      stream: true,
      max_tokens: MAX_REPLY_TOKENS,
      ...SAMPLING,
      ...(request.signal ? { abortSignal: request.signal } : {}),
      ...(request.thinkingSwitch ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      ...(request.jsonSchema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'action', schema: request.jsonSchema, strict: true },
            },
          }
        : {}),
    });
    return this.pieces(chunks);
  }

  private async *pieces(chunks: AsyncIterable<unknown>): AsyncIterable<string> {
    let timings: Timings | undefined;
    for await (const chunk of chunks as AsyncIterable<Chunk>) {
      timings = chunk.timings ?? timings;
      yield chunk.choices[0]?.delta.content ?? '';
    }
    if (__WEBAIASSIST_SMOKE__ && timings) recordTimings(timings);
  }

  threads(): number {
    return this.wllama.getNumThreads();
  }

  exit(): Promise<void> {
    return this.wllama.exit();
  }
}

export const createWllamaEngine: WllamaFactory = () => new WllamaEngine();

/** Only the stored files, with no engine: for the model list in the panel and in Options, which
 *  never run a model. The same default storage the engine uses. wllama is loaded on first use, so
 *  a page that never lists processor models does not carry it. */
export function createWllamaStorage(): Pick<WllamaEngineLike, 'storedBytes' | 'remove'> {
  let cache: Promise<CacheManager> | undefined;
  const manager = (): Promise<CacheManager> =>
    (cache ??= import('@wllama/wllama/esm/index.js').then((m) => new m.CacheManager()));
  return {
    storedBytes: async (url) => {
      const files = await manager();
      return files.getSize(await files.getNameFromURL(url));
    },
    remove: async (url) => (await manager()).delete(url),
  };
}
