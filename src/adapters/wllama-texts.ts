// SPDX-License-Identifier: Apache-2.0
// The plain sentences of the CPU runtime (src/adapters/wllama-runtime.ts): progress, a
// download that stopped, a file that did not match, and a computer without enough memory.
import type { CpuModel } from './cpu-models';

const MB = 1_000_000;
const megabytes = (bytes: number): number => Math.round(bytes / MB);
const modelName = (model: CpuModel): string => model.label.split(' (')[0] ?? model.id;

export function progressText(model: CpuModel, loaded: number, total: number): string {
  const size = total > 0 ? total : model.bytes;
  const percent = Math.min(100, Math.round((loaded / size) * 100));
  return `Downloading ${modelName(model)}: ${megabytes(loaded)} of ${megabytes(size)} MB (${percent}%)`;
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The browser refused to store the file: its quota or the disk is full. */
export function isOutOfSpace(error: unknown): boolean {
  if (error instanceof Error && error.name === 'QuotaExceededError') return true;
  return /quota|no space|disk (?:is )?full/i.test(reason(error));
}

export function noSpace(model: CpuModel): string {
  return (
    `The browser has no space to store ${modelName(model)} (${megabytes(model.bytes)} MB). ` +
    'Remove downloaded models in Options, or free disk space, then press Start.'
  );
}

export function downloadStopped(error: unknown): string {
  return `The download stopped: ${reason(error)}. Nothing was kept. Press Start to try again.`;
}

export function mismatch(model: CpuModel): string {
  return (
    `The downloaded file for ${modelName(model)} did not match its checksum and was deleted. ` +
    'Nothing from it was used. Press Start to download it again.'
  );
}

/** WebAssembly and the allocator report a lack of memory in several ways. */
const MEMORY = /memory|alloc|out of bounds|too large|RangeError/i;

export function cpuLoadError(error: unknown, model: CpuModel): string {
  const text = reason(error);
  if (!MEMORY.test(text) && !(error instanceof RangeError)) return text;
  return (
    `${modelName(model)} needs about ${model.memoryMb} MB of free memory and this computer ` +
    'could not give it. Close other tabs or choose the smaller model, then press Start. ' +
    `(${text})`
  );
}
