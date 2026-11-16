// SPDX-License-Identifier: Apache-2.0
// The model bar of the side panel: the list and the sentence that says why one is selected,
// Start and Cancel, the question before a first download, loading, and what to do when loading
// fails. Everything browser-specific comes in through PanelDeps.
import { gpuSpeed } from '../adapters/gpu-speed';
import type { ModelRuntime } from '../core/ports/model-runtime';
import { isLocalEndpoint } from '../adapters/endpoint-runtime';
import { whyFor } from './default-model';
import { endpointHost } from './endpoint-host';
import { bindBanner } from './error-banner';
import { byId, element } from './dom';
import { t } from './i18n';
import { timeFirstToken } from './first-token-timer';
import {
  groupLabel,
  pickerChoices,
  selectedValue,
  settingsFor,
  type PickerChoice,
} from './model-picker';
import type { HostName, PanelController } from './panel-controller';
import { bindConsent, closeConsent, downloadNeed, shortName, showConsent } from './panel-consent';
import { remoteOf } from './panel-consent';
import { drawPage } from './panel-page';
import { problemText } from './problems';

const select = (ctx: PanelController): HTMLSelectElement =>
  byId<HTMLSelectElement>(ctx.deps.doc, 'model');

/** The one sentence under the model list, and the same reason in the welcome screen. */
export function showWhy(ctx: PanelController): void {
  const { state } = ctx;
  const why = whyFor(state.settings, state.env, select(ctx).value);
  byId(ctx.deps.doc, 'model-why').textContent = t(why.why, why.values);
  const choice = state.choices.find((c) => c.value === select(ctx).value);
  const name = choice ? shortName(choice.label) : '';
  byId(ctx.deps.doc, 'first-run-model').textContent = t('firstRunModel', {
    name,
    why: t(why.why, why.values),
  });
}

export function fillPicker(ctx: PanelController): void {
  const { deps, state } = ctx;
  state.choices = pickerChoices(state.settings, state.env);
  const list = select(ctx);
  const previous = list.value;
  list.replaceChildren(
    ...(['local', 'server'] as const).flatMap((group) => {
      const options = state.choices
        .filter((choice) => choice.group === group)
        .map((choice) => {
          const option = element(deps.doc, 'option', choice.label);
          option.value = choice.value;
          return option;
        });
      if (options.length === 0) return [];
      const heading = element(deps.doc, 'optgroup');
      heading.label = groupLabel(group);
      heading.append(...options);
      return [heading];
    }),
  );
  // A refill after an Options change keeps the panel's choice when it is still offered.
  const kept = state.choices.some((c) => c.value === previous) ? previous : undefined;
  list.value = kept ?? selectedValue(state.settings, state.env);
  showWhy(ctx);
}

// ---- starting and loading ----------------------------------------------------------------

function currentChoice(ctx: PanelController): PickerChoice | undefined {
  return ctx.state.choices.find((c) => c.value === select(ctx).value);
}

async function startModel(ctx: PanelController): Promise<void> {
  const { deps, state, ui } = ctx;
  const choice = currentChoice(ctx);
  if (!choice) return;
  if (choice.runtime === 'setup') {
    deps.openOptions();
    return ui.showProgress({ fraction: 0, text: t('setupOpened') });
  }
  if (!(await graphicsUsable(ctx, choice))) return;
  const need = await downloadNeed(ctx, choice);
  if (!need) return loadModel(ctx, choice, false);
  if (state.loading) return;
  showConsent(ctx, choice, need);
}

/** The panel's own WebGPU probe can say no where the offscreen document finds an adapter, so a
 *  "no" is checked with the hosts' probe before anything is asked or downloaded: with no graphics
 *  acceleration anywhere the user gets the error and "Use the processor instead" at once. */
async function graphicsUsable(ctx: PanelController, choice: PickerChoice): Promise<boolean> {
  if (choice.runtime !== 'webllm' || ctx.state.env.webgpu !== false) return true;
  try {
    await ctx.deps.createRuntime(choice, ctx.state.settings);
    return true;
  } catch (error) {
    ctx.ui.showProgress({ fraction: 0, text: t('loadFailed', { why: problemText(error) }) });
    ctx.report(error, { choice, quiet: true });
    return false;
  }
}

async function loadModel(
  ctx: PanelController,
  choice: PickerChoice,
  downloaded: boolean,
): Promise<void> {
  const { state, ui } = ctx;
  const loading = new AbortController();
  setLoading(ctx, loading);
  ui.showProgress({ fraction: 0, text: t('loading', { model: choice.label }) });
  try {
    const { runtime, host } = await loadChoice(ctx, choice, loading);
    if (loading.signal.aborted) throw new Error(t('loadCancelled'));
    state.runtime = {
      model: measured(ctx, choice, runtime),
      label: choice.label,
      ...remoteOf(ctx, choice),
    };
    ui.showProgress({ fraction: 1, text: readyLine(ctx, choice, host, runtime) });
    drawPage(ctx);
    if (downloaded) askPersistence(ctx, choice);
  } catch (error) {
    const aborted = loading.signal.aborted;
    const why = aborted ? t('loadCancelled') : problemText(error);
    ui.showProgress({ fraction: 0, text: t('loadFailed', { why }) });
    if (!aborted) ctx.report(error, { choice, quiet: true });
  } finally {
    setLoading(ctx, undefined);
  }
}

/** After the first successful download of weights into this browser (never at install): ask
 *  Chrome to keep them when space runs low. Once only; Chrome decides, and a refusal is fine. */
function askPersistence(ctx: PanelController, choice: PickerChoice): void {
  const { deps, state } = ctx;
  if (choice.runtime !== 'webllm' && choice.runtime !== 'cpu') return;
  if (state.persisted.persistAsked === true || !deps.persistStorage) return;
  state.persisted = { ...state.persisted, persistAsked: true };
  void deps.saveState({ persistAsked: true }).catch(() => undefined);
  void deps.persistStorage().catch(() => undefined);
}

/** A graphics-card model reports the wait for its first token; the stored measurement decides
 *  later whether the graphics card may be the default (src/adapters/gpu-speed.ts). */
function measured(ctx: PanelController, choice: PickerChoice, runtime: ModelRuntime): ModelRuntime {
  const key = ctx.state.env.gpuKey;
  if (choice.runtime !== 'webllm' || key === undefined) return runtime;
  return timeFirstToken(
    runtime,
    () => ctx.deps.nowMs(),
    (firstAnswerMs) => {
      const gpu = { key, firstAnswerMs };
      const speed = gpuSpeed(gpu, key);
      if (speed) ctx.state.env = { ...ctx.state.env, gpuMeasure: { speed, firstAnswerMs } };
      void ctx.deps.saveState({ gpu }).catch(() => undefined);
    },
  );
}

/**
 * Releases the model that is loaded, creates the runtime of `choice` and loads it. Chrome's
 * built-in model starts its download only from a click (about 5 s of activation), so for that
 * choice load() runs first and the old model is let go while it waits; the other runtimes need
 * the old model's memory back before they load.
 */
async function loadChoice(
  ctx: PanelController,
  choice: PickerChoice,
  loading: AbortController,
): Promise<{ runtime: ModelRuntime; host?: HostName }> {
  const { deps, state, ui } = ctx;
  const previous = state.runtime;
  state.runtime = undefined;
  const fromClick = choice.runtime === 'prompt-api';
  if (!fromClick) await previous?.model.unload();
  const made = await deps.createRuntime(choice, state.settings);
  const load = made.runtime.load(
    choice.modelId,
    (p) => {
      if (!loading.signal.aborted) ui.showProgress(p);
    },
    loading.signal,
  );
  if (fromClick) void previous?.model.unload().catch(() => undefined);
  await untilCancelled(load, loading.signal, () => made.runtime.unload());
  return made;
}

/** The load, or the Cancel press, whichever comes first. Cancel answers at once: the panel stops
 *  waiting, the signal tells the runtime to stop, and when the load settles later it is not
 *  shown; a model that still loaded after Cancel is unloaded (nothing holds it). */
function untilCancelled(
  load: Promise<void>,
  signal: AbortSignal,
  unload: () => Promise<void>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cancelled = (): void => reject(new Error(t('loadCancelled')));
    signal.addEventListener('abort', cancelled, { once: true });
    load
      .then(async () => {
        if (signal.aborted) await unload().catch(() => undefined);
        else resolve();
      }, reject)
      .finally(() => signal.removeEventListener('abort', cancelled));
  });
}

/** "cpu:4" from the processor host: the model runs in memory with that many threads. */
function cpuReady(model: string, where: string): string {
  const count = Number(where.slice('cpu:'.length));
  const threads = count === 1 ? t('threadOne') : t('threadMany', { count: String(count) });
  return t('runsOnCpu', { model, threads });
}

/** The line when a model is ready. Every kind says where it runs: in this browser (on the
 *  graphics card, or on the processor and memory), in Chrome on this computer, on your own server
 *  on this computer, or remote (then also where the chat goes). */
function readyLine(
  ctx: PanelController,
  choice: PickerChoice,
  host: HostName | undefined,
  runtime: ModelRuntime,
): string {
  const where = runtime.where?.();
  if (choice.runtime === 'endpoint') return endpointReady(ctx);
  const model = shortName(choice.label);
  if (where?.startsWith('cpu:')) return cpuReady(model, where);
  switch (choice.runtime) {
    case 'webllm':
      return gpuReady(model, host, where);
    case 'cpu':
      return t('runsOnCpuPlain', { model });
    case 'prompt-api':
      return t('readyChrome', { model });
    default:
      return t('ready', { model });
  }
}

function endpointReady(ctx: PanelController): string {
  const { url, model } = ctx.state.settings.endpoint;
  const key = isLocalEndpoint(url) ? 'readyOwnServer' : 'readyRemote';
  return t(key, { model, host: endpointHost(url) });
}

function gpuReady(model: string, host: HostName | undefined, where: string | undefined): string {
  if (where === 'offscreen-main') return t('runsOnMain', { model });
  if (host === undefined) return t('runsOnGpu', { model });
  return t('runsIn', { model, host: t(host === 'offscreen' ? 'hostOffscreen' : 'hostWorker') });
}

/** Start is off and Cancel is shown while a model loads. */
function setLoading(ctx: PanelController, loading: AbortController | undefined): void {
  ctx.state.loading = loading;
  byId<HTMLButtonElement>(ctx.deps.doc, 'start').disabled = loading !== undefined;
  byId<HTMLButtonElement>(ctx.deps.doc, 'cancel-load').hidden = loading === undefined;
}

/** Selects the processor model and saves it as the user's choice (the "use the processor" button). */
export function chooseProcessor(ctx: PanelController): void {
  const value = ctx.state.choices.find((c) => c.runtime === 'cpu')?.value;
  if (value === undefined) return;
  select(ctx).value = value;
  saveChoice(ctx);
}

/** Starts the selected model again (the "restart the model" button). */
export function restartModel(ctx: PanelController): Promise<void> {
  return startModel(ctx);
}

function saveChoice(ctx: PanelController): void {
  const { deps, state } = ctx;
  closeConsent(ctx, false);
  void deps.saveSettings(settingsFor(state.settings, select(ctx).value)).then((saved) => {
    state.settings = saved;
    showWhy(ctx);
  });
}

export function bindModel(ctx: PanelController): void {
  const { deps } = ctx;
  byId(deps.doc, 'start').addEventListener('click', () => void startModel(ctx));
  byId(deps.doc, 'cancel-load').addEventListener('click', () => ctx.state.loading?.abort());
  // Closing the panel lets the model go (Chrome's sessions and downloads end with it) and
  // ends any run, so no tool is called afterwards.
  deps.doc.defaultView?.addEventListener('pagehide', () => {
    ctx.state.loading?.abort();
    ctx.state.running?.abort();
    void ctx.state.runtime?.model.unload().catch(() => undefined);
  });
  select(ctx).addEventListener('change', () => saveChoice(ctx));
  bindConsent(ctx, (choice) => void loadModel(ctx, choice, true));
  bindBanner(deps.doc);
}
