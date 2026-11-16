// SPDX-License-Identifier: Apache-2.0
// "Reset" on the Options page: the settings go back to their defaults, the remote chat hosts the
// user agreed to are forgotten, and the host permission that the chat endpoint asked for is given
// back (that one pattern only; no other permission is touched).
import { endpointAccess } from './options-form';
import { loadSettings, resetSettings, type StorageAreaLike } from '../adapters/settings';
import { savePanelState } from '../adapters/stored-panel-state';

export interface ResetDeps {
  readonly area: StorageAreaLike;
  removeOrigins(origins: string[]): Promise<boolean>;
}

/** The endpoint's host pattern, or undefined when no endpoint is set up or its address is invalid. */
function endpointPattern(url: string, model: string): string | undefined {
  if (model === '') return undefined;
  try {
    return endpointAccess(url).pattern;
  } catch {
    return undefined;
  }
}

export async function resetOptions(deps: ResetDeps): Promise<void> {
  const { endpoint } = await loadSettings(deps.area);
  await resetSettings(deps.area);
  await savePanelState(deps.area, { endpointHosts: [] });
  const pattern = endpointPattern(endpoint.url, endpoint.model);
  if (pattern === undefined) return;
  try {
    await deps.removeOrigins([pattern]);
  } catch {
    // The permission was never granted, or Chrome refuses to remove it: nothing else to undo.
  }
}
