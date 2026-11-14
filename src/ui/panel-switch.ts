// SPDX-License-Identifier: Apache-2.0
// What happens when the tab in front moves to another site: a running answer is stopped (a
// question waiting in the dialog is answered Deny) with one plain line, and the chat of the
// new site is shown, saved or empty. Moving to another page of the same site changes nothing.
import { t } from './i18n';
import type { PanelController } from './panel-controller';
import { savedEntries } from './saved-chat';

function hostOf(origin: string | undefined): string | undefined {
  if (origin === undefined) return undefined;
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** Stops a running answer that belongs to another site. Returns a function that writes the
 *  plain lines about it (to call after the new site's chat is shown), or undefined. */
export function stopForSwitch(
  ctx: PanelController,
  origin: string | undefined,
): (() => void) | undefined {
  const { running, runOrigin } = ctx.state;
  if (!running || runOrigin === origin) return undefined;
  const pending = ctx.ui.pendingToolName();
  ctx.state.stoppedBySwitch = true;
  running.abort();
  ctx.ui.cancelDialog();
  const host = hostOf(origin);
  return () => {
    if (pending !== undefined)
      ctx.ui.show({ kind: 'note', text: t('callNotRun', { name: pending }) });
    const text = host === undefined ? t('stoppedSwitchUnknown') : t('stoppedSwitch', { host });
    ctx.ui.show({ kind: 'note', text });
  };
}

/** Shows the chat of `origin`: the saved one, or an empty chat (with Memory off nothing is saved). */
export async function showSiteChat(
  ctx: PanelController,
  origin: string | undefined,
): Promise<void> {
  ctx.ui.reset();
  if (origin === undefined) return;
  try {
    const memory = await ctx.deps.memory(ctx.state.settings);
    ctx.ui.restore(savedEntries(await memory.loadChat(origin)));
  } catch {
    // A chat that cannot be read is shown as empty; the next answer is still saved.
  }
}
