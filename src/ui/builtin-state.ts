// SPDX-License-Identifier: Apache-2.0
// The panel's line about Chrome's built-in model (in Help, and in the model line while that
// model is chosen and nothing is loaded): Chrome's availability state in plain words, with the
// requirements when Chrome says "unavailable". Reading the state never starts a download.
import type { BuiltInState } from '../adapters/prompt-api-state';
import { byId } from './dom';
import { t } from './i18n';
import type { MessageKey } from './messages-en';
import type { PanelController } from './panel-controller';

const KEYS: Readonly<Record<BuiltInState, MessageKey>> = {
  absent: 'builtInAbsent',
  unavailable: 'builtInUnavailable',
  downloadable: 'builtInDownloadable',
  downloading: 'builtInDownloading',
  available: 'builtInAvailable',
  unknown: 'builtInUnknown',
};

export const builtInText = (state: BuiltInState): string => t(KEYS[state]);

/** Shows the state in the model line when the built-in model is chosen and idle. */
function follow(ctx: PanelController, text: string): void {
  const doc = ctx.deps.doc;
  const status = byId(doc, 'model-status');
  if (ctx.state.runtime || ctx.state.loading) return;
  if (byId<HTMLSelectElement>(doc, 'model').value === 'prompt-api') status.textContent = text;
  else if (status.textContent === text) status.textContent = t('notStarted');
}

export async function showBuiltInState(ctx: PanelController): Promise<void> {
  if (!ctx.deps.builtInState) return;
  const text = builtInText(await ctx.deps.builtInState());
  byId(ctx.deps.doc, 'builtin-state').textContent = text;
  byId(ctx.deps.doc, 'model').addEventListener('change', () => follow(ctx, text));
  follow(ctx, text);
}
