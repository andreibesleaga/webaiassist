// SPDX-License-Identifier: Apache-2.0
// The side panel: wires the page's controls to the model, the page bridge and the agent
// loop. Every browser API comes in through PanelDeps (src/entries/sidepanel.ts builds the
// real ones), so the whole panel runs in jsdom tests with fakes.
import type { PageInfo } from '../adapters/messaging-tool-bridge';
import type { Settings } from '../adapters/settings';
import type { BuiltInState } from '../adapters/prompt-api-state';
import type { AllowResult } from '../adapters/site-access';
import type { ArgsValidator } from '../core/ports/args-validator';
import type { Clock } from '../core/ports/clock';
import type { Memory } from '../core/ports/memory';
import type { ModelRuntime } from '../core/ports/model-runtime';
import type { SiteGrants } from '../core/ports/site-grants';
import type { ToolBridge } from '../core/ports/tool-bridge';
import { gpuSpeed } from '../adapters/gpu-speed';
import type { StoreLike } from '../adapters/model-store';
import type { StoredPanelState } from '../adapters/stored-panel-state';
import { showBuiltInState } from './builtin-state';
import { hideBanner } from './error-banner';
import { byId } from './dom';
import { t } from './i18n';
import { SETUP_VALUE, type PickerChoice, type PickerEnv } from './model-picker';
import { bindActions } from './panel-actions';
import { refreshPage } from './panel-page';
import { bindModel, fillPicker } from './panel-model';
import { bindNotices } from './panel-notices';
import type { PageStatus } from './page-status';
import type { Outcomes, SiteFacts } from '../core/site-facts';
import type { SiteDeps } from './site-deps';
import { startFollowing } from './panel-follow';
import { PanelUI } from './panel-ui';
import { reportProblem, type ReportOptions } from './panel-problems';
import { bindQuestion } from './panel-run';

export type HostName = 'offscreen' | 'worker' | 'cpu';

export interface PanelDeps {
  readonly doc: Document;
  readonly env: PickerEnv;
  readonly bridge: ToolBridge & { page(tabId: number): Promise<PageInfo> };
  readonly grants: SiteGrants;
  readonly clock: Clock;
  readonly validator: ArgsValidator;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  memory(settings: Settings): Promise<Memory>;
  targetTab(): Promise<number | undefined>;
  readPage(tabId: number): Promise<{ origin: string; title: string; text: string }>;
  /** "Allow WebAIAssist on this site", called straight from the click (user gesture). */
  allowSite(page: { tabId: number; origin?: string }): Promise<AllowResult>;
  /** Called straight from the click, so the permission prompt keeps the user gesture. */
  enableCompat(page: { tabId: number; origin: string }): Promise<'enabled' | 'already' | 'denied'>;
  /** "Forget this site": memory, session allowance, compat mode, host access. */
  forgetSite(origin: string): Promise<void>;
  createRuntime(
    choice: PickerChoice,
    settings: Settings,
  ): Promise<{ runtime: ModelRuntime; host?: HostName }>;
  download(fileName: string, text: string): void;
  openOptions(): void;
  /** Opens the graph explorer tab for a tab and its site (the "Graph: N items" chip); absent in tests that skip it. */
  openGraph?(tabId: number, origin: string): void;
  /** The model files stored in this browser (for the question before a download). */
  readonly store: StoreLike;
  /** What the panel remembers besides the Options (welcome screen, measured first answer). */
  loadState(): Promise<StoredPanelState>;
  saveState(patch: Partial<StoredPanelState>): Promise<StoredPanelState>;
  /** Milliseconds from a steady clock, for timing the first answer. */
  nowMs(): number;
  isOnline(): boolean;
  copyText(text: string): Promise<void>;
  /** The extension version, for "Copy details". */
  readonly version: string;
  /** `navigator.storage.persist()`: asked once after the first successful download. Chrome
   *  decides; the panel does not claim the answer. Absent where the browser has no such call. */
  persistStorage?(): Promise<boolean>;
  /** Chrome's built-in model state (never starts a download); absent in tests that skip it. */
  builtInState?(): Promise<BuiltInState>;
  /** What the site publishes and the browser events the panel follows; a host without it shows
   *  the tools of the page only. */
  readonly site?: SiteDeps;
}

export interface PanelState {
  settings: Settings;
  /** What the model list knows about this computer, plus the measured graphics card. */
  env: PickerEnv;
  persisted: StoredPanelState;
  choices: PickerChoice[];
  /** The question before a first download, while it is shown. */
  consent?: { readonly choice: PickerChoice; readonly previousStatus: string };
  runtime?: {
    readonly model: ModelRuntime;
    readonly label: string;
    /** The model is an endpoint the user chose: the chat goes to that address. */
    readonly remote?: boolean;
  };
  page?: {
    readonly tabId: number;
    readonly origin?: string;
    readonly info?: PageInfo;
    /** The tab's title and address, read only for a site the panel may read. */
    readonly title?: string;
    readonly url?: string;
  };
  /** Counts refreshes: an answer that comes back after a newer refresh began is dropped. */
  refreshSeq: number;
  /** What was read from the open site: the files once per tab and origin, then the facts. */
  site?: SiteState;
  /** The reading of the site that is under way; a question waits for it. */
  siteLoading?: Promise<void>;
  /** The question being answered: the site it started on. */
  runOrigin?: string;
  /** Set when the run was stopped because the tab moved to another site. */
  stoppedBySwitch?: boolean;
  /** The title of the page the tab moved to on the same site while an answer ran. */
  pageChangedTo?: string;
  /** What the status line shows about the page. */
  status?: PageStatus;
  /** Text from "Read this page", bound to the tab and site it was read on. */
  pageText?: PageText;
  /** The last error text the panel showed, cleaned (src/core/diagnostics.ts); for diagnostics. */
  lastError?: string;
  running?: AbortController;
  /** The model download in progress; Cancel aborts it. */
  loading?: AbortController;
}

export interface SiteState {
  readonly tabId: number;
  readonly origin: string;
  /** The reading of the files, shared by refreshes that overlap. */
  readonly files: Promise<Outcomes>;
  facts?: SiteFacts;
  /** The user chose "Use on this tab anyway" for a site that signals no AI input. */
  override: boolean;
}

export interface PageText {
  readonly tabId: number;
  readonly origin: string;
  readonly text: string;
}

export interface PanelController {
  readonly deps: PanelDeps;
  readonly ui: PanelUI;
  readonly state: PanelState;
  /** Re-reads the Options (after they change) and refills the model list. */
  reloadSettings(): Promise<void>;
  /** Reads the open page again (after a tab switch or a navigation). */
  refresh(): Promise<void>;
  /** Shows a failure in the banner above the question box. */
  report(error: unknown, options?: ReportOptions): void;
  hideBanner(): void;
}

/** The list's view of this computer: what the host passed in, Chrome's built-in model state and
 *  the stored first-answer measurement of this graphics card. */
async function pickerEnv(deps: PanelDeps, persisted: StoredPanelState): Promise<PickerEnv> {
  const builtIn = await deps.builtInState?.().catch(() => undefined);
  const speed = gpuSpeed(persisted.gpu, deps.env.gpuKey);
  return {
    ...deps.env,
    ...(builtIn ? { builtIn } : {}),
    ...(speed && persisted.gpu
      ? { gpuMeasure: { speed, firstAnswerMs: persisted.gpu.firstAnswerMs } }
      : {}),
  };
}

export async function startPanel(deps: PanelDeps): Promise<PanelController> {
  const persisted = await deps.loadState();
  const state: PanelState = {
    settings: await deps.loadSettings(),
    env: await pickerEnv(deps, persisted),
    persisted,
    choices: [],
    refreshSeq: 0,
  };
  const ctx: PanelController = {
    deps,
    ui: new PanelUI(deps.doc),
    state,
    reloadSettings: async () => {
      state.settings = await deps.loadSettings();
      fillPicker(ctx);
    },
    refresh: () => refreshPage(ctx),
    report: (error, options = {}) => reportProblem(ctx, error, options),
    hideBanner: () => hideBanner(deps.doc),
  };
  fillPicker(ctx);
  if (byId<HTMLSelectElement>(deps.doc, 'model').value === SETUP_VALUE) {
    ctx.ui.showProgress({ fraction: 0, text: t('noGpuSetup') });
  }
  bindModel(ctx);
  bindNotices(ctx);
  bindQuestion(ctx);
  bindActions(ctx);
  startFollowing(ctx);
  void showBuiltInState(ctx);
  await refreshPage(ctx);
  return ctx;
}
