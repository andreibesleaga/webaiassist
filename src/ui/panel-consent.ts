// SPDX-License-Identifier: Apache-2.0
// The question before a first download of weights: what it costs (size, source, where it is
// stored), "Download" or "Not now". Nothing downloads before the first. A model that is already
// stored and Chrome's model that is ready ask nothing. A remote chat endpoint gets the same kind
// of question once per host: where the model runs, what is sent there, that it may cost money.
// An endpoint on this computer asks nothing.
import { isLocalEndpoint } from '../adapters/endpoint-runtime';
import { isStored } from '../adapters/model-store';
import { byId } from './dom';
import { downloadBytes } from './download-size';
import { endpointHost } from './endpoint-host';
import { t } from './i18n';
import type { PickerChoice } from './model-picker';
import type { PanelController } from './panel-controller';

const MB = 1_000_000;
export const shortName = (label: string): string => label.split(' (')[0] ?? label;

interface DownloadNeed {
  readonly name: string;
  readonly megabytes: number;
  readonly host: string;
  /** "checked": the file's SHA-256 is verified; "chrome": Chrome's own. */
  readonly kind: 'checked' | 'chrome' | 'remote';
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
  choice: PickerChoice,
): Promise<DownloadNeed | undefined> {
  if (isStored(await storedList(ctx), choice.modelId)) return undefined;
  const source = downloadBytes(choice, ctx.state.env);
  if (!source) return undefined;
  const megabytes = Math.round(source.bytes / MB);
  return { name: shortName(choice.label), megabytes, host: source.host, kind: 'checked' };
}

/** What a first download of this choice costs, or undefined when nothing has to download. */
export async function downloadNeed(
  ctx: PanelController,
  choice: PickerChoice,
): Promise<DownloadNeed | undefined> {
  if (choice.runtime === 'webllm' || choice.runtime === 'cpu') {
    return needOfStored(ctx, choice);
  }
  if (choice.runtime === 'endpoint') return remoteNeed(ctx);
  if (choice.runtime !== 'prompt-api') return undefined;
  if ((await ctx.deps.builtInState?.()) !== 'downloadable') return undefined;
  return { name: shortName(choice.label), megabytes: 0, host: 'Chrome', kind: 'chrome' };
}

/** The hosts the user agreed to, read from storage at the question: "Forget all" or "Reset" in
 *  Options may have emptied the list while this panel was open. When storage cannot be read the
 *  list is taken as empty, so the question is asked again. */
async function agreedHosts(ctx: PanelController): Promise<readonly string[]> {
  let hosts: readonly string[] = [];
  try {
    hosts = (await ctx.deps.loadState()).endpointHosts ?? [];
  } catch {
    // Asking again is the safe answer.
  }
  const { endpointHosts: _old, ...rest } = ctx.state.persisted;
  ctx.state.persisted = hosts.length > 0 ? { ...rest, endpointHosts: hosts } : rest;
  return hosts;
}

/** The question for a remote endpoint whose host the user has not agreed to yet. */
async function remoteNeed(ctx: PanelController): Promise<DownloadNeed | undefined> {
  const { url } = ctx.state.settings.endpoint;
  if (isLocalEndpoint(url)) return undefined;
  const host = endpointHost(url);
  if ((await agreedHosts(ctx)).includes(host)) return undefined;
  return { name: host, megabytes: 0, host, kind: 'remote' };
}

/** Whether a started model is an endpoint and, for a remote one, the host it talks to. */
export function remoteOf(
  ctx: PanelController,
  choice: PickerChoice,
): { remote: boolean; remoteHost?: string } {
  const { url } = ctx.state.settings.endpoint;
  const remote = choice.runtime === 'endpoint';
  return remote && !isLocalEndpoint(url) ? { remote, remoteHost: endpointHost(url) } : { remote };
}

/** Before each question to a remote endpoint: false when the user no longer agrees to its host
 *  ("Forget all" or "Reset" in Options) or changed the endpoint's address there. The model is
 *  then let go, so nothing more is sent, and the line says to press Start. */
export async function remoteStillAgreed(ctx: PanelController): Promise<boolean> {
  const host = ctx.state.runtime?.remoteHost;
  if (host === undefined) return true;
  const { url } = ctx.state.settings.endpoint;
  const same = !isLocalEndpoint(url) && endpointHost(url) === host;
  if (same && (await agreedHosts(ctx)).includes(host)) return true;
  ctx.state.runtime = undefined;
  ctx.ui.showProgress({ fraction: 0, text: t('remoteWithdrawn', { host }) });
  return false;
}

/** Keeps the host the user agreed to, so the question is not asked again for it. The list it
 *  adds to is read from storage again at the click: a list emptied in Options while the question
 *  was open stays empty but for this host. */
async function rememberHost(ctx: PanelController): Promise<void> {
  const host = endpointHost(ctx.state.settings.endpoint.url);
  const hosts = [...(await agreedHosts(ctx)).filter((known) => known !== host), host];
  ctx.state.persisted = { ...ctx.state.persisted, endpointHosts: hosts };
  await ctx.deps.saveState({ endpointHosts: hosts }).catch(() => undefined);
}

function consentTexts(need: DownloadNeed): {
  title: string;
  body: string;
  ok: string;
  status: string;
} {
  const values = { name: need.name, size: need.megabytes, host: need.host };
  if (need.kind === 'remote') {
    return {
      title: t('remoteTitle', values),
      body: t('remoteBody', values),
      ok: t('remoteOk'),
      status: t('remoteStatus', values),
    };
  }
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
    body: t('consentBody', values),
    ok: t('consentOk', values),
    status: t('consentStatus', values),
  };
}

export function showConsent(ctx: PanelController, choice: PickerChoice, need: DownloadNeed): void {
  const doc = ctx.deps.doc;
  const offline = !ctx.deps.isOnline();
  const texts = consentTexts(need);
  const status = byId(doc, 'model-status');
  ctx.state.consent = { choice, previousStatus: status.textContent ?? '', host: need.host };
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

/** The user pressed the question's OK. For a remote endpoint the host is the one the question
 *  named: when the endpoint was changed in Options while the question was open, the question is
 *  asked again for the new host, and nothing is remembered or loaded for it unasked. */
async function agree(ctx: PanelController, load: (choice: PickerChoice) => void): Promise<void> {
  const consent = ctx.state.consent;
  closeConsent(ctx, false);
  if (!consent) return;
  if (consent.choice.runtime === 'endpoint') {
    const need = await remoteNeed(ctx);
    if (need && need.host !== consent.host) return showConsent(ctx, consent.choice, need);
    if (need) await rememberHost(ctx);
  }
  load(consent.choice);
}

export function bindConsent(ctx: PanelController, load: (choice: PickerChoice) => void): void {
  const doc = ctx.deps.doc;
  byId(doc, 'consent-ok').addEventListener('click', () => void agree(ctx, load));
  byId(doc, 'consent-no').addEventListener('click', () => closeConsent(ctx, true));
  byId(doc, 'consent').addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeConsent(ctx, true);
  });
}
