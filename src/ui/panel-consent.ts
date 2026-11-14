// SPDX-License-Identifier: Apache-2.0
// The question before a first download of weights: what it costs (size, source, where it is
// stored), "Download" or "Not now". Nothing downloads before the first. A model that is already
// stored, an endpoint and Chrome's model that is ready ask nothing.
import { isStored, type StoredRuntime } from '../adapters/model-store';
import { byId } from './dom';
import { downloadBytes } from './download-size';
import { t } from './i18n';
import type { PickerChoice } from './model-picker';
import type { PanelController } from './panel-controller';

const MB = 1_000_000;
export const shortName = (label: string): string => label.split(' (')[0] ?? label;

interface DownloadNeed {
  readonly name: string;
  readonly megabytes: number;
  readonly host: string;
  /** "checked": the file's SHA-256 is verified; "pinned": a fixed version; "chrome": Chrome's own. */
  readonly kind: 'checked' | 'pinned' | 'chrome';
}

async function storedList(ctx: PanelController) {
  try {
    return await ctx.deps.store.list();
  } catch {
    return [];
  }
}

async function needOfStored(
  ctx: PanelController,
  runtime: StoredRuntime,
  choice: PickerChoice,
): Promise<DownloadNeed | undefined> {
  if (isStored(await storedList(ctx), runtime, choice.modelId)) return undefined;
  const source = downloadBytes(choice, ctx.state.env);
  if (!source) return undefined;
  const megabytes = Math.round(source.bytes / MB);
  const kind = runtime === 'webllm' ? 'pinned' : 'checked';
  return { name: shortName(choice.label), megabytes, host: source.host, kind };
}

/** What a first download of this choice costs, or undefined when nothing has to download. */
export async function downloadNeed(
  ctx: PanelController,
  choice: PickerChoice,
): Promise<DownloadNeed | undefined> {
  if (choice.runtime === 'webllm' || choice.runtime === 'cpu') {
    return needOfStored(ctx, choice.runtime, choice);
  }
  if (choice.runtime !== 'prompt-api') return undefined;
  if ((await ctx.deps.builtInState?.()) !== 'downloadable') return undefined;
  return { name: shortName(choice.label), megabytes: 0, host: 'Chrome', kind: 'chrome' };
}

function consentTexts(need: DownloadNeed): {
  title: string;
  body: string;
  ok: string;
  status: string;
} {
  const values = { name: need.name, size: need.megabytes, host: need.host };
  if (need.kind === 'chrome') {
    return {
      title: t('consentChromeTitle'),
      body: t('consentChromeBody'),
      ok: t('consentOkChrome'),
      status: t('consentStatusChrome'),
    };
  }
  return {
    title: t('consentTitle', values),
    body: t(need.kind === 'checked' ? 'consentBody' : 'consentBodyPinned', values),
    ok: t('consentOk', values),
    status: t('consentStatus', values),
  };
}

export function showConsent(ctx: PanelController, choice: PickerChoice, need: DownloadNeed): void {
  const doc = ctx.deps.doc;
  const offline = !ctx.deps.isOnline();
  const texts = consentTexts(need);
  const status = byId(doc, 'model-status');
  ctx.state.consent = { choice, previousStatus: status.textContent ?? '' };
  byId(doc, 'consent-title').textContent = texts.title;
  byId(doc, 'consent-body').textContent = offline
    ? t('consentOffline', { name: need.name })
    : texts.body;
  byId(doc, 'consent-ok').textContent = texts.ok;
  byId(doc, 'consent-ok').hidden = offline;
  status.textContent = offline ? t('consentOffline', { name: need.name }) : texts.status;
  byId(doc, 'consent').hidden = false;
  byId<HTMLButtonElement>(doc, 'start').disabled = true;
  byId(doc, offline ? 'consent-no' : 'consent-ok').focus();
}

/** Hides the question; `declined` is true when the user said "Not now" (Start gets the focus). */
export function closeConsent(ctx: PanelController, declined: boolean): void {
  const { consent } = ctx.state;
  if (!consent) return;
  const doc = ctx.deps.doc;
  ctx.state.consent = undefined;
  byId(doc, 'consent').hidden = true;
  byId<HTMLButtonElement>(doc, 'start').disabled = ctx.state.loading !== undefined;
  if (!declined) return;
  byId(doc, 'model-status').textContent = consent.previousStatus;
  byId(doc, 'start').focus();
}

export function bindConsent(ctx: PanelController, load: (choice: PickerChoice) => void): void {
  const doc = ctx.deps.doc;
  byId(doc, 'consent-ok').addEventListener('click', () => {
    const choice = ctx.state.consent?.choice;
    closeConsent(ctx, false);
    if (choice) load(choice);
  });
  byId(doc, 'consent-no').addEventListener('click', () => closeConsent(ctx, true));
  byId(doc, 'consent').addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeConsent(ctx, true);
  });
}
