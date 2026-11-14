// SPDX-License-Identifier: Apache-2.0
// Whether this browser can run the processor models. The llama.cpp build in the package needs
// WebAssembly promise integration (JSPI, Chrome 137) and 64-bit memory (Chrome 133); older
// browsers would need wllama's compatibility build from the web, which this extension never uses.

export interface WasmLike {
  readonly Suspending?: unknown;
  validate(bytes: BufferSource): boolean;
}

export type CpuSupport =
  { readonly supported: true } | { readonly supported: false; readonly why: string };

/** A module with one 64-bit memory: valid only where memory64 is. */
const MEMORY64_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 4, 1]);

export function cpuRuntimeSupport(wasm: WasmLike | undefined): CpuSupport {
  if (!wasm) return { supported: false, why: 'This browser has no WebAssembly.' };
  if (wasm.Suspending === undefined) {
    return { supported: false, why: 'The processor model needs Chrome 137 or newer.' };
  }
  if (!wasm.validate(MEMORY64_PROBE)) {
    return {
      supported: false,
      why: 'The processor model needs 64-bit memory (Chrome 133 or newer).',
    };
  }
  return { supported: true };
}
