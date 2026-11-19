// SPDX-License-Identifier: Apache-2.0
// The weights of a local model on disk and checked, for src/adapters/wllama-runtime.ts: taken
// from the stored copy, or downloaded now. Every file is checked against the recorded size and
// SHA-256 before it is used: a file that differs is deleted and never loaded. A stored copy
// that was checked once starts without a download and without a new hash. Cancel stops the
// download at once and deletes what was written.
import type { LoadProgress } from '../core/ports/model-runtime';
import { PART_BYTES, type CpuModel } from './cpu-models';
import type { WllamaEngineLike } from './wllama-runtime';
import { downloadStopped, isOutOfSpace, mismatch, noSpace, progressText } from './wllama-texts';

export const CANCELLED = 'The download was cancelled.';
/** The share of the progress bar the download takes; the check and the load take the rest. */
const DOWNLOAD_SHARE = 0.9;

/** Throws the cancel error when the user pressed Cancel. */
export function checkCancel(signal: AbortSignal): void {
  if (signal.aborted) throw new Error(CANCELLED);
}

/** The weights on disk and checked: from the stored copy, or downloaded and checked now. */
export async function fetchWeights(
  engine: WllamaEngineLike,
  model: CpuModel,
  onProgress: (progress: LoadProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  const stored = await engine.storedBytes(model.url);
  if (stored === model.bytes && (await engine.isChecked(model.url, model.sha256))) return;
  if (stored !== model.bytes) {
    if (stored !== -1) await engine.remove(model.url);
    await download(engine, model, onProgress, signal);
  }
  checkCancel(signal);
  onProgress({ fraction: DOWNLOAD_SHARE, text: 'Checking the downloaded file (SHA-256)…' });
  await check(engine, model);
}

async function download(
  engine: WllamaEngineLike,
  model: CpuModel,
  onProgress: (progress: LoadProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  try {
    await engine.download(
      model.url,
      (loaded, total) => {
        const fraction = Math.min(1, loaded / (total || model.bytes)) * DOWNLOAD_SHARE;
        if (!signal.aborted) onProgress({ fraction, text: progressText(model, loaded, total) });
      },
      signal,
    );
  } catch (error) {
    await engine.remove(model.url).catch(() => undefined);
    if (signal.aborted) throw new Error(CANCELLED);
    throw new Error(isOutOfSpace(error) ? noSpace(model) : downloadStopped(error));
  }
  if ((await engine.storedBytes(model.url)) !== model.bytes) await reject(engine, model);
}

/** True when the stored copy has the recorded SHA-256: of the whole file, or of every piece of
 *  a file too large for one call. */
async function sameBytes(engine: WllamaEngineLike, model: CpuModel): Promise<boolean> {
  if (model.parts === undefined) return (await engine.sha256(model.url)) === model.sha256;
  const found = await engine.sha256Parts(model.url, PART_BYTES);
  return found.length === model.parts.length && found.every((hash, i) => hash === model.parts?.[i]);
}

/** Hashes the stored copy; a copy that differs is deleted and the load ends with an error. */
async function check(engine: WllamaEngineLike, model: CpuModel): Promise<void> {
  if (!(await sameBytes(engine, model))) await reject(engine, model);
  await engine.markChecked(model.url, model.sha256);
}

async function reject(engine: WllamaEngineLike, model: CpuModel): Promise<never> {
  await engine.remove(model.url);
  throw new Error(mismatch(model));
}
