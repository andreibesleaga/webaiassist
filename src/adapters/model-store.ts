// SPDX-License-Identifier: Apache-2.0
// The model files stored in this browser: which are there, how big, and removal. The panel asks
// before a first download with it, and Options lists and removes with it. Every file belongs to
// the one local engine (llama.cpp), which keeps them in the extension's private file storage; a
// model offered on the graphics card and on the processor is one file and is listed once.
import { findCpuModel, type CpuModel } from './cpu-models';
import type { WllamaEngineLike } from './wllama-runtime';

/** The engine a stored file belongs to. One today; the tag stays in the list and in removal. */
export type StoredRuntime = 'cpu';

export interface StoredModel {
  readonly runtime: StoredRuntime;
  readonly id: string;
  /** Plain name, e.g. "Qwen3 0.6B". */
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

/** The model's name without where it runs: the file serves both. */
const nameOf = (label: string): string =>
  (label.split(' (')[0] ?? label).replace(/ on the processor$/, '');

/** The stored files: one of exactly the recorded size counts; a partial one does not (the
 *  runtime deletes it before it downloads again). */
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
        found.push({ runtime: 'cpu', id: model.id, name: nameOf(model.label), bytes: model.bytes });
      }
      return found;
    },
    async remove(id) {
      const model = findCpuModel(id, models);
      if (model) await engine.remove(model.url);
    },
  };
}

/** True when the file of model `id` is stored, whichever way the model is offered. */
export const isStored = (list: readonly StoredModel[], id: string): boolean =>
  list.some((m) => m.id === id);

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
