// SPDX-License-Identifier: Apache-2.0
// Turns a failure into the banner above the question box: one plain sentence and the buttons that
// say what to do next. The conversation is never touched, so the chat is kept.
import { endpointHost } from './endpoint-host';
import { showBanner, type BannerAction } from './error-banner';
import { downloadBytes } from './download-size';
import { t } from './i18n';
import type { PickerChoice } from './model-picker';
import { note } from './panel-actions';
import type { PanelController } from './panel-controller';
import { chooseProcessor, restartModel } from './panel-model';
import { classifyProblem, errorDetails, problemText, type ProblemKind } from './problems';

export interface ReportOptions {
  /** The model that was loading, for the size in "no space". */
  readonly choice?: PickerChoice;
  /** A load already says why on the model line: only the kinds with a next step get a banner. */
  readonly quiet?: boolean;
}

function processorAction(ctx: PanelController): BannerAction[] {
  if (ctx.state.env.cpu !== true) return [];
  return [{ id: 'use-cpu', label: t('useCpu'), run: () => closeAnd(ctx, chooseProcessor) }];
}

function closeAnd(ctx: PanelController, then: (ctx: PanelController) => void): void {
  ctx.hideBanner();
  then(ctx);
}

function copyAction(ctx: PanelController, error: unknown): BannerAction {
  return {
    id: 'copy-error',
    label: t('copyDetails'),
    run: async () => {
      await ctx.deps.copyText(errorDetails(ctx.deps.version, error));
      note(ctx, t('detailsCopied'));
    },
  };
}

function optionsAction(ctx: PanelController): BannerAction {
  return { id: 'open-storage', label: t('openOptionsButton'), run: () => ctx.deps.openOptions() };
}

function megabytes(ctx: PanelController, choice: PickerChoice | undefined): number {
  const source = choice ? downloadBytes(choice, ctx.state.env) : undefined;
  return Math.round((source?.bytes ?? 0) / 1_000_000);
}

function banner(
  ctx: PanelController,
  kind: ProblemKind,
  error: unknown,
  options: ReportOptions,
): { text: string; actions: BannerAction[] } {
  switch (kind) {
    case 'no-gpu':
      return { text: problemText(error), actions: processorAction(ctx) };
    case 'device-lost':
    case 'model-stopped':
      return {
        text: t(kind === 'device-lost' ? 'deviceLost' : 'modelStopped'),
        actions: [
          { id: 'restart-model', label: t('restartModel'), run: () => void restartModel(ctx) },
          ...processorAction(ctx),
        ],
      };
    case 'no-space': {
      const size = megabytes(ctx, options.choice);
      return { text: t('noSpace', { size }), actions: [optionsAction(ctx)] };
    }
    case 'endpoint-refused':
      return {
        text: t('endpointRefused', { host: endpointHost(ctx.state.settings.endpoint.url) }),
        actions: [optionsAction(ctx)],
      };
    case 'unexpected':
      return {
        text: t('unexpected', { why: problemText(error).slice(0, 300) }),
        actions: [copyAction(ctx, error)],
      };
  }
}

/** The sentence the chat shows for a failure: plain words for a model that is gone, never the
 *  library's own text; any other failure as it came. */
export function shownText(error: unknown): string {
  const kind = classifyProblem(error);
  if (kind === 'device-lost') return t('deviceLost');
  if (kind === 'model-stopped') return t('modelStopped');
  return problemText(error);
}

/** A model that is gone is no longer "Ready": the line says so and a question waits for Start. */
function dropRuntime(ctx: PanelController): void {
  ctx.state.runtime = undefined;
  ctx.ui.showProgress({ fraction: 0, text: t('modelStopped') });
}

export function reportProblem(ctx: PanelController, error: unknown, options: ReportOptions): void {
  const kind = classifyProblem(error);
  if (kind === 'unexpected' && options.quiet === true) return;
  const { text, actions } = banner(ctx, kind, error, options);
  showBanner(ctx.deps.doc, text, actions);
  // While a model loads, the model line already says why it did not load.
  if ((kind === 'device-lost' || kind === 'model-stopped') && options.quiet !== true) {
    dropRuntime(ctx);
  }
}
