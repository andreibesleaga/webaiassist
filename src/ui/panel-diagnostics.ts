// SPDX-License-Identifier: Apache-2.0
// Gathers the facts of "Copy diagnostics" in the side panel from what the panel already knows.
// Only fixed fields: no page text, no title, no address, no key. The host of the open site only
// when the user ticked the box.
import type { DiagnosticsFacts } from '../core/diagnostics';
import { bindDiagnostics } from './diagnostics-ui';
import { byId } from './dom';
import { t } from './i18n';
import type { PanelController } from './panel-controller';
import { note } from './panel-note';
import type { PickerChoice } from './model-picker';

const CHROME = /(?:Chrome|Edg|Firefox)\/[\d.]+/;

/** "Chrome/157.0.0.0" from the browser's own user-agent text. */
export function browserOf(userAgent: string): string {
  return CHROME.exec(userAgent)?.[0] ?? t('diagBrowserUnknown');
}

function whereOf(ctx: PanelController, choice: PickerChoice | undefined): string | undefined {
  const runtime = ctx.state.runtime;
  if (!runtime || !choice) return undefined;
  switch (choice.runtime) {
    case 'webllm':
      return t('diagWhereGpu');
    case 'cpu':
      return t('diagWhereCpu');
    case 'prompt-api':
      return t('diagWhereChrome');
    case 'endpoint':
      return t('diagWhereEndpoint');
    default:
      return undefined;
  }
}

function webmcpOf(ctx: PanelController): string {
  const info = ctx.state.page?.info;
  if (!info) return t(ctx.state.page === undefined ? 'diagWebmcpNoPage' : 'diagWebmcpUnknown');
  if (info.webmcp === false) return t('diagWebmcpNoBrowser');
  if (info.tools.length > 0 || info.webmcp === true) {
    return t('diagWebmcpPresent', { count: info.tools.length });
  }
  return t('diagWebmcpUnknown');
}

function gpuOf(ctx: PanelController): DiagnosticsFacts['gpu'] {
  const { env } = ctx.state;
  if (env.webgpu !== true) return undefined;
  const [vendor, architecture] = (env.gpuKey ?? '').split('/');
  return {
    ...(vendor ? { vendor } : {}),
    ...(architecture ? { architecture } : {}),
    shaderF16: env.shaderF16 === true,
  };
}

function hostOf(origin: string | undefined): string | undefined {
  return origin === undefined ? undefined : origin.replace(/^https?:\/\//, '');
}

export function panelFacts(ctx: PanelController, includeHost: boolean): DiagnosticsFacts {
  const { state, deps } = ctx;
  const value = byId<HTMLSelectElement>(deps.doc, 'model').value;
  const choice = state.choices.find((c) => c.value === value);
  const model = state.runtime?.label;
  const where = whereOf(ctx, choice);
  const gpu = gpuOf(ctx);
  const host = includeHost ? hostOf(state.page?.origin) : undefined;
  return {
    version: deps.version,
    browser: browserOf(deps.doc.defaultView?.navigator.userAgent ?? ''),
    webmcp: webmcpOf(ctx),
    builtIn: state.env.builtIn ?? 'not checked',
    ...(model === undefined ? {} : { model }),
    ...(where === undefined ? {} : { where }),
    ...(gpu ? { gpu } : {}),
    ...(state.lastError === undefined ? {} : { lastError: state.lastError }),
    ...(host === undefined ? {} : { host }),
  };
}

export function bindPanelDiagnostics(ctx: PanelController): void {
  bindDiagnostics({
    doc: ctx.deps.doc,
    gather: (includeHost) => Promise.resolve(panelFacts(ctx, includeHost)),
    secrets: () => [ctx.state.settings.endpoint.apiKey],
    copy: (text) => ctx.deps.copyText(text),
    say: (text) => note(ctx, text),
  });
}
