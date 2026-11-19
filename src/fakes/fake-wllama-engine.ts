// SPDX-License-Identifier: Apache-2.0
// A stand-in for the llama.cpp engine, for the browser tests of the built extension. It is
// in the smoke-test build only (src/entries/shared/cpu-engine.ts). The "stored files" survive
// a restart of the offscreen document (localStorage), as the real ones survive a restart of
// the browser. Four test models stand for the four cases the scenarios need.
import type { CpuModel } from '../adapters/cpu-models';
import type { WllamaChatRequest, WllamaEngineLike } from '../adapters/wllama-runtime';

const SIZE = 1_000_000;
const SHA = 'a'.repeat(64);

const smoke = (id: string, label: string): CpuModel => ({
  id,
  label: `${label} (test build only; no real model)`,
  url: `https://huggingface.co/smoke/${id}/resolve/${'0'.repeat(40)}/${id}.gguf`,
  bytes: SIZE,
  sha256: SHA,
  licence: 'Apache-2.0',
  memoryMb: 64,
  thinkingSwitch: false,
});

/** Good file; file with the wrong SHA-256; download that drops once half way; no memory; no
 *  space to store the file.
 *  A function, so a build that does not call it holds none of these names. */
export const smokeCpuModels = (): readonly CpuModel[] => [
  smoke('smoke-cpu', 'Smoke CPU model'),
  smoke('smoke-cpu-bad-sum', 'Smoke CPU model with a wrong checksum'),
  smoke('smoke-cpu-drop', 'Smoke CPU model whose download drops once'),
  smoke('smoke-cpu-big', 'Smoke CPU model that needs too much memory'),
  smoke('smoke-cpu-full', 'Smoke CPU model that needs a free disk'),
];

interface Stored {
  bytes: number;
  hash: string;
  checked: boolean;
}
const KEY = 'webaiassist.fake-cpu-disk';
const memory: { disk: Record<string, Stored>; drops: Record<string, number> } = {
  disk: {},
  drops: {},
};

function read(): typeof memory {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<typeof memory>) : {};
    memory.disk = saved.disk ?? {};
    memory.drops = saved.drops ?? {};
  } catch {
    // Storage refused: the fake keeps its state for the life of the document.
  }
  return memory;
}

function write(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // See read().
  }
}

const PROGRESS_STEPS = 20;

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

class FakeWllamaEngine implements WllamaEngineLike {
  storedBytes(url: string): Promise<number> {
    return Promise.resolve(read().disk[url]?.bytes ?? -1);
  }

  async download(
    url: string,
    onProgress: (loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const state = read();
    // Twenty small steps (2.5 percent each), as a real download reports many: the panel must
    // not announce each one.
    for (let step = 1; step <= PROGRESS_STEPS; step += 1) {
      await pause(20);
      if (signal?.aborted) throw new Error('aborted');
      onProgress((SIZE / 2) * (step / PROGRESS_STEPS), SIZE);
    }
    if (url.includes('smoke-cpu-drop') && (state.drops[url] ?? 0) === 0) {
      state.drops[url] = 1;
      write();
      throw new Error('the connection was lost');
    }
    if (url.includes('smoke-cpu-full')) {
      throw Object.assign(new Error('The quota has been exceeded.'), {
        name: 'QuotaExceededError',
      });
    }
    await pause(40);
    const hash = url.includes('smoke-cpu-bad-sum') ? 'b'.repeat(64) : SHA;
    state.disk[url] = { bytes: SIZE, hash, checked: false };
    write();
    onProgress(SIZE, SIZE);
  }

  sha256(url: string): Promise<string> {
    return Promise.resolve(read().disk[url]?.hash ?? '');
  }

  /** The test models are small files with no piece hashes: never asked for. */
  sha256Parts(): Promise<string[]> {
    return Promise.resolve([]);
  }

  remove(url: string): Promise<void> {
    delete read().disk[url];
    write();
    return Promise.resolve();
  }

  isChecked(url: string, sha256: string): Promise<boolean> {
    const stored = read().disk[url];
    return Promise.resolve(stored?.checked === true && stored.hash === sha256);
  }

  markChecked(url: string): Promise<void> {
    const stored = read().disk[url];
    if (stored) stored.checked = true;
    write();
    return Promise.resolve();
  }

  load(url: string): Promise<void> {
    if (url.includes('smoke-cpu-big')) {
      return Promise.reject(new RangeError('WebAssembly.Memory(): could not allocate memory'));
    }
    return Promise.resolve();
  }

  chat(request: WllamaChatRequest): Promise<AsyncIterable<string>> {
    const asked = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    const reply = JSON.stringify({ answer: `Processor model reply to: ${asked.slice(0, 80)}` });
    return Promise.resolve(
      (async function* () {
        for (const piece of reply.match(/.{1,12}/g) ?? []) {
          await pause(5);
          yield piece;
        }
      })(),
    );
  }

  threads(): number {
    return 2;
  }

  exit(): Promise<void> {
    return Promise.resolve();
  }
}

export const createFakeEngine = (): WllamaEngineLike => new FakeWllamaEngine();
