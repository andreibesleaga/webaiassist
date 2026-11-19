// SPDX-License-Identifier: Apache-2.0
// The words of the failures that mean a graphics-card model is gone. The runtimes send errors
// through a port as plain text, so the host and the panel tell them by their words.

/** A load or reply that says the GPU device is gone: Dawn's DXGI_ERROR_DEVICE_REMOVED, a lost
 *  device, or the freed objects that follow one. The local runtime says "the device was lost"
 *  when its engine ended on the graphics card (src/adapters/wllama-runtime.ts). The host cannot
 *  get a working adapter again in place (measured 13 Nov 2026), so it starts again. */
export const DEVICE_LOST =
  /DEVICE_REMOVED|device (?:was |is )?lost|device has been lost|has already been disposed/i;

/** What the user is told when the engine is gone; never the engine's own sentence. */
export const MODEL_STOPPED = 'The model stopped. Press Start to load it again.';
