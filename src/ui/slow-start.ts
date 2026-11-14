// SPDX-License-Identifier: Apache-2.0
// The first generation after a model loads compiles the model's GPU programs, which takes
// tens of seconds on a slow GPU (about 40 s measured on 13 Nov 2026) while the panel shows
// nothing. This wraps the chat surface for one question: when no draft text has arrived after
// `afterMs`, the draft line says why; the first token replaces it.
import type { ChatUI } from '../core/ports/chat-ui';
import { t } from './i18n';

export const SLOW_START_MS = 4000;

/** The wrapped surface and the function to call when the question is over. */
export function withSlowStartNotice(
  ui: ChatUI,
  afterMs = SLOW_START_MS,
): { readonly ui: ChatUI; readonly done: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    ui.showDraft(t('slowFirstAnswer'));
  }, afterMs);
  const done = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    done,
    ui: {
      show: (event) => ui.show(event),
      confirmToolCall: (request) => ui.confirmToolCall(request),
      showProgress: (progress) => ui.showProgress(progress),
      showDraft: (text) => {
        done();
        ui.showDraft(text);
      },
    },
  };
}
