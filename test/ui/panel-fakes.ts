// SPDX-License-Identifier: Apache-2.0
// A full fake dependency set for the panel controller: no chrome.*, no real model.
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import type { PageInfo } from '../../src/adapters/messaging-tool-bridge';
import { DEFAULT_SETTINGS, type Settings } from '../../src/adapters/settings';
import { AjvArgsValidator } from '../../src/adapters/ajv-args-validator';
import type { ModelRuntime } from '../../src/core/ports/model-runtime';
import type { SiteGrants } from '../../src/core/ports/site-grants';
import type { ToolInfo } from '../../src/core/types';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { FakeToolBridge } from '../../src/fakes/fake-tool-bridge';
import { FixedClock } from '../../src/fakes/fixed-clock';
import { InMemoryMemory } from '../../src/fakes/in-memory-memory';
import { CPU_MODELS } from '../../src/adapters/cpu-models';
import type { StoredModel, StoreLike } from '../../src/adapters/model-store';
import { modelChoices, WEBLLM_DOWNLOADS } from '../../src/adapters/models';
import type { StoredPanelState } from '../../src/adapters/stored-panel-state';
import type { Outcomes } from '../../src/core/site-facts';
import type { PageMeta } from '../../src/core/site-page';
import type { SiteTarget } from '../../src/adapters/site-files';
import type { PanelDeps } from '../../src/ui/panel-controller';
import type { BrowserEvent, SiteDeps } from '../../src/ui/site-deps';
import type { PickerChoice } from '../../src/ui/model-picker';
import type { AllowResult } from '../../src/adapters/site-access';
import { AGSC_TOOLS } from '../helpers';

export const ORIGIN = 'https://node.example';

/** The fake bridge plus page(): a page with tools, or a page that has none. */
export class FakePanelBridge extends FakeToolBridge {
  pageResult: PageInfo | PageError;
  /** What a given tab shows; a tab not listed shows `pageResult`. */
  readonly pageByTab = new Map<number, PageInfo | PageError>();
  pageCalls = 0;
  constructor(tools: readonly ToolInfo[] = AGSC_TOOLS, linkset = false) {
    super(tools);
    this.pageResult = { origin: ORIGIN, linkset, tools };
  }
  page(tabId?: number): Promise<PageInfo> {
    this.pageCalls += 1;
    const result = (tabId === undefined ? undefined : this.pageByTab.get(tabId)) ?? this.pageResult;
    return result instanceof PageError ? Promise.reject(result) : Promise.resolve(result);
  }
}

/** The reading of a site and the browser events, controlled by the test. */
export class FakeSite implements SiteDeps {
  outcomes: Outcomes = {};
  meta: PageMeta | undefined;
  readonly tabs = new Map<number, { title?: string; url?: string }>();
  readonly fileCalls: SiteTarget[] = [];
  readonly tabCalls: number[] = [];
  private listener: ((event: BrowserEvent) => void) | undefined;
  files(target: SiteTarget): Promise<Outcomes> {
    this.fileCalls.push(target);
    return Promise.resolve(this.outcomes);
  }
  page(): Promise<PageMeta | undefined> {
    return Promise.resolve(this.meta);
  }
  tab(tabId: number): Promise<{ title?: string; url?: string }> {
    this.tabCalls.push(tabId);
    return Promise.resolve(this.tabs.get(tabId) ?? {});
  }
  events(listener: (event: BrowserEvent) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }
  emit(event: BrowserEvent): void {
    this.listener?.(event);
  }
}

export class MemoryGrants implements SiteGrants {
  readonly origins = new Set<string>();
  has(origin: string): Promise<boolean> {
    return Promise.resolve(this.origins.has(origin));
  }
  add(origin: string): Promise<void> {
    this.origins.add(origin);
    return Promise.resolve();
  }
}

/** A model store the tests can change: by default every model is already on this computer, so
 *  Start loads at once; a test that checks the question before a download empties `stored`. */
export class FakeStore implements StoreLike {
  stored: StoredModel[] = [
    ...modelChoices({ promptApi: false }).map((m) => ({
      runtime: 'webllm' as const,
      id: m.id,
      name: `${m.label.split(' (')[0]} on the graphics card`,
      bytes: WEBLLM_DOWNLOADS[m.id] ?? 0,
    })),
    ...CPU_MODELS.map((m) => ({
      runtime: 'cpu' as const,
      id: m.id,
      name: m.label.split(' (')[0] ?? m.id,
      bytes: m.bytes,
    })),
  ];
  readonly removed: string[] = [];
  list(): Promise<StoredModel[]> {
    return Promise.resolve([...this.stored]);
  }
  remove(runtime: StoredModel['runtime'], id: string): Promise<void> {
    this.removed.push(`${runtime}:${id}`);
    this.stored = this.stored.filter((m) => !(m.runtime === runtime && m.id === id));
    return Promise.resolve();
  }
  async removeAll(): Promise<{ count: number; bytes: number }> {
    const all = [...this.stored];
    for (const m of all) await this.remove(m.runtime, m.id);
    return { count: all.length, bytes: all.reduce((sum, m) => sum + m.bytes, 0) };
  }
}

export interface FakeDeps extends PanelDeps {
  readonly store: FakeStore;
  panelState: StoredPanelState;
  readonly copied: string[];
  online: boolean;
  now: number;
  readonly bridge: FakePanelBridge;
  readonly site?: FakeSite;
  /** The tab the panel works on; a test moves it to simulate a tab switch. */
  currentTab: number;
  readonly grants: MemoryGrants;
  readonly memoryStore: InMemoryMemory;
  readonly downloads: { name: string; text: string }[];
  readonly compatCalls: { tabId: number; origin: string }[];
  readonly forgotten: string[];
  forgetError?: Error;
  readonly created: PickerChoice[];
  readonly saved: Settings[];
  env: PanelDeps['env'];
  settings: Settings;
  model: ModelRuntime;
  optionsOpened: number;
  compatResult: 'enabled' | 'already' | 'denied';
  readonly allowCalls: { tabId: number; origin?: string }[];
  allowResult: AllowResult;
  /** Runs when Allow is answered, before the panel sees the answer (a grant changes the page). */
  onAllow?: () => void;
}

export function fakeDeps(
  replies: string[],
  options: { bridge?: FakePanelBridge; site?: FakeSite } = {},
): FakeDeps {
  const memoryStore = new InMemoryMemory();
  const deps: FakeDeps = {
    doc: document,
    env: { promptApi: false, scripted: false },
    bridge: options.bridge ?? new FakePanelBridge(),
    ...(options.site ? { site: options.site } : {}),
    currentTab: 7,
    grants: new MemoryGrants(),
    clock: new FixedClock(),
    validator: new AjvArgsValidator(),
    memoryStore,
    downloads: [],
    compatCalls: [],
    forgotten: [],
    created: [],
    saved: [],
    settings: DEFAULT_SETTINGS,
    model: new FakeModelRuntime(replies),
    optionsOpened: 0,
    compatResult: 'enabled',
    allowCalls: [],
    allowResult: 'granted',
    loadSettings: () => Promise.resolve(deps.settings),
    saveSettings: (settings) => {
      deps.saved.push(settings);
      deps.settings = settings;
      return Promise.resolve(settings);
    },
    memory: () => Promise.resolve(memoryStore),
    targetTab: () => Promise.resolve(deps.currentTab),
    readPage: () => Promise.resolve({ origin: ORIGIN, title: 'Cats', text: 'Cats are calm.' }),
    enableCompat: (page) => {
      deps.compatCalls.push(page);
      return Promise.resolve(deps.compatResult);
    },
    allowSite: (page) => {
      deps.allowCalls.push(page);
      deps.onAllow?.();
      return Promise.resolve(deps.allowResult);
    },
    forgetSite: (origin) => {
      if (deps.forgetError) return Promise.reject(deps.forgetError);
      deps.forgotten.push(origin);
      return Promise.resolve();
    },
    createRuntime: (choice) => {
      deps.created.push(choice);
      return Promise.resolve({ runtime: deps.model, host: 'offscreen' as const });
    },
    download: (name, text) => deps.downloads.push({ name, text }),
    openOptions: () => {
      deps.optionsOpened += 1;
    },
    store: new FakeStore(),
    panelState: { firstRunDone: true },
    copied: [],
    online: true,
    now: 0,
    loadState: () => Promise.resolve(deps.panelState),
    saveState: (patch) => {
      deps.panelState = { ...deps.panelState, ...patch };
      return Promise.resolve(deps.panelState);
    },
    nowMs: () => deps.now,
    isOnline: () => deps.online,
    copyText: (text) => {
      deps.copied.push(text);
      return Promise.resolve();
    },
    version: '0.1.0-test',
  };
  return deps;
}
