// SPDX-License-Identifier: Apache-2.0
import { byId } from './dom';
import type { PanelController } from './panel-controller';

/** The one-line message about the last page action; the next message replaces it. */
export function note(ctx: PanelController, text: string): void {
  byId(ctx.deps.doc, 'page-note').textContent = text;
}
