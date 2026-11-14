// SPDX-License-Identifier: Apache-2.0
// The words of the failures that mean a graphics-card model is gone. The runtimes send errors
// through a port as plain text, so the host and the panel tell them by their words.

/** A load or reply that says the GPU device is gone: Dawn's DXGI_ERROR_DEVICE_REMOVED, a lost
 *  device, or the freed objects that follow one. When the device is lost, WebLLM's
 *  `device.lost` handler unloads the engine and tvmjs disposes its instance
 *  (@mlc-ai/web-llm 0.2.86, lib/index.js), and the call still in flight then throws "Object has
 *  already been disposed". Both handlers run only for a loss that was not asked for (WebLLM sets
 *  `deviceLostIsError` to false before its own unload). The owner's laptop run of 14 Nov 2026 showed
 *  exactly this on the first question of Llama 3.2 3B. The host cannot get a working adapter
 *  again in place (measured 13 Nov 2026). */
export const DEVICE_LOST =
  /DEVICE_REMOVED|device (?:was |is )?lost|device has been lost|has already been disposed/i;

/** WebLLM's own error for a chat on an engine that has no model loaded (its class name, which the
 *  worker engine puts in front of the message, or the first words of the message). */
export const NOT_LOADED = /ModelNotLoadedError|Model not loaded before trying to complete/i;

/** What the user is told when the engine is gone; never WebLLM's own sentence. */
export const MODEL_STOPPED = 'The model stopped. Press Start to load it again.';
