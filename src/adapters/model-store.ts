// SPDX-License-Identifier: Apache-2.0
// The model files stored in this browser, across both local runtimes: which are there, how big,
// and removal. The panel asks before a first download with it, and Options lists and removes with
// it. Each runtime keeps its own cache (WebLLM in the Cache API, the processor runtime in the
// extension's private file storage); a backend wraps one of them, and the store only joins them.
import { findCpuModel, type CpuModel } from './cpu-models';
import { modelChoices, WEBLLM_MODEL_IDS } from './models';
import type { WllamaEngineLike } from './wllama-runtime';

export type StoredRuntime = 'webllm' | 'cpu';

export interface StoredModel {
  readonly runtime: StoredRuntime;
  readonly id: string;
  /** Plain name, e.g. "Qwen3 0.6B on the processor". */
  readonly name: string;
  readonly bytes: number;
}

export interface ModelBackend {
  readonly runtime: StoredRuntime;
  list(): Promise<StoredModel[]>;
  remove(id: string): Promise<void>;
}

/** The part of the model store that the panel and the Options page use. */
export interface StoreLike {
  list(): Promise<StoredModel[]>;
  remove(runtime: StoredRuntime, id: string): Promise<void>;
  removeAll(): Promise<{ count: number; bytes: number }>;
}

const nameOf = (label: string, suffix: string): string =>
  `${label.split(' (')[0] ?? label}${suffix}`;

/** Processor models: a stored file of exactly the recorded size counts; a partial one does not
 *  (the runtime deletes it before it downloads again). */
export function cpuBackend(
  engine: Pick<WllamaEngineLike, 'storedBytes' | 'remove'>,
  models: readonly CpuModel[],
): ModelBackend {
  return {
    runtime: 'cpu',
    async list() {
      const found: StoredModel[] = [];
      for (const model of models) {
        if ((await engine.storedBytes(model.url)) !== model.bytes) continue;
        found.push({
          runtime: 'cpu',
          id: model.id,
          name: nameOf(model.label, ''),
          bytes: model.bytes,
        });
      }
      return found;
    },
    async remove(id) {
      const model = findCpuModel(id, models);
      if (model) await engine.remove(model.url);
    },
  };
}

/** What the WebLLM adapter in src/entries/shared/webllm-store.ts provides. */
export interface WebLlmFiles {
  has(id: string): Promise<boolean>;
  size(id: string): Promise<number>;
  remove(id: string): Promise<void>;
}

const LABELS = new Map(modelChoices({ promptApi: false }).map((m) => [m.id, m.label]));

export function webllmBackend(files: WebLlmFiles): ModelBackend {
  return {
    runtime: 'webllm',
    async list() {
      const found: StoredModel[] = [];
      for (const id of WEBLLM_MODEL_IDS) {
        if (!(await files.has(id))) continue;
        const name = nameOf(LABELS.get(id) ?? id, ' on the graphics card');
        found.push({ runtime: 'webllm', id, name, bytes: await files.size(id) });
      }
      return found;
    },
    remove: (id) => files.remove(id),
  };
}

export const isStored = (
  list: readonly StoredModel[],
  runtime: StoredRuntime,
  id: string,
): boolean => list.some((m) => m.runtime === runtime && m.id === id);

export class ModelStore implements StoreLike {
  constructor(private readonly backends: readonly ModelBackend[]) {}

  /** One backend that cannot be read (no cache in this context) leaves the others listed. */
  async list(): Promise<StoredModel[]> {
    const lists = await Promise.all(this.backends.map((b) => b.list().catch(() => [])));
    return lists.flat();
  }

  async remove(runtime: StoredRuntime, id: string): Promise<void> {
    const backend = this.backends.find((b) => b.runtime === runtime);
    if (backend) await backend.remove(id);
  }

  async removeAll(): Promise<{ count: number; bytes: number }> {
    const all = await this.list();
    for (const model of all) await this.remove(model.runtime, model.id);
    return { count: all.length, bytes: all.reduce((sum, m) => sum + m.bytes, 0) };
  }
}

/** The part of a Cache (the Cache API) that sizes use. */
export interface CacheLike {
  keys(): Promise<readonly { readonly url: string }[]>;
  match(request: { readonly url: string }): Promise<
    | {
        readonly headers: { get(name: string): string | null };
        blob(): Promise<{ readonly size: number }>;
      }
    | undefined
  >;
}

/** Bytes of the cached files whose address starts with `prefix`: the length header when there
 *  is one, else the stored size (a file-backed blob; nothing is read into memory). */
export async function bytesUnder(cache: CacheLike, prefix: string): Promise<number> {
  let total = 0;
  for (const request of await cache.keys()) {
    if (!request.url.startsWith(prefix)) continue;
    const response = await cache.match(request);
    if (!response) continue;
    const length = Number(response.headers.get('content-length'));
    total += Number.isFinite(length) && length > 0 ? length : (await response.blob()).size;
  }
  return total;
}
