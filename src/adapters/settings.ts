// SPDX-License-Identifier: Apache-2.0
// The Options, kept in chrome.storage.local under one key with a version number. Every
// read goes through normalizeSettings, so a missing, old or tampered value becomes a
// valid one: unknown values fall back to the default, numbers are clamped.
import { WEBLLM_MODEL_IDS } from './models';

export const SETTINGS_KEY = 'settings';
/** 3 since the automatic default of 14 Nov 2026 (see runtime()). */
export const SETTINGS_VERSION = 3;

/** 'auto' means the user has not chosen: the panel picks by measurement and says why. */
export type RuntimeChoice = 'auto' | 'webllm' | 'cpu' | 'prompt-api' | 'endpoint';
export type ConfirmMode = 'every-call' | 'per-site';
export type Language = 'en';

export interface Settings {
  readonly version: 3;
  readonly runtime: RuntimeChoice;
  /** One of the shipped WebLLM models; '' means the default (see defaultModelId). */
  readonly webllmModel: string;
  /** A processor model (src/adapters/cpu-models.ts); '' means the default. */
  readonly cpuModel: string;
  readonly endpoint: {
    readonly url: string;
    readonly model: string;
    readonly apiKey: string;
    /** The endpoint model's context window in tokens (the saved chat is trimmed to fit). */
    readonly contextTokens: number;
  };
  readonly maxSteps: number;
  readonly confirmMode: ConfirmMode;
  readonly memory: boolean;
  /** Give the model short "site facts" from what the site publishes (untrusted, capped). */
  readonly siteFacts: boolean;
  readonly language: Language;
}

/** The part of chrome.storage.StorageArea used here. */
export interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export const ENDPOINT_PRESETS = [
  { name: 'Ollama', url: 'http://localhost:11434/v1' },
  { name: 'LM Studio', url: 'http://localhost:1234/v1' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
] as const;

export const MAX_STEPS_LIMIT = 12;
export const CONTEXT_TOKENS_RANGE = { min: 1024, max: 1_000_000 } as const;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  runtime: 'auto',
  webllmModel: '',
  cpuModel: '',
  endpoint: { url: ENDPOINT_PRESETS[0].url, model: '', apiKey: '', contextTokens: 8192 },
  maxSteps: 6,
  confirmMode: 'every-call',
  memory: true,
  siteFacts: true,
  language: 'en',
};

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw =>
  typeof value === 'object' && value !== null ? (value as Raw) : {};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, 2048) : fallback;
}

/** A plain model id; the host checks it against its own list before anything loads. */
const PLAIN_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function cpuModel(value: unknown): string {
  return typeof value === 'string' && PLAIN_ID.test(value) ? value : DEFAULT_SETTINGS.cpuModel;
}

function steps(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.maxSteps;
  return Math.min(MAX_STEPS_LIMIT, Math.max(1, Math.round(value)));
}

function contextTokens(value: unknown): number {
  const fallback = DEFAULT_SETTINGS.endpoint.contextTokens;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const { min, max } = CONTEXT_TOKENS_RANGE;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function endpoint(value: unknown): Settings['endpoint'] {
  const raw = asRecord(value);
  const fallback = DEFAULT_SETTINGS.endpoint;
  return {
    url: text(raw.url, fallback.url),
    model: text(raw.model, fallback.model),
    apiKey: text(raw.apiKey, fallback.apiKey),
    contextTokens: contextTokens(raw.contextTokens),
  };
}

const RUNTIMES: readonly RuntimeChoice[] = ['auto', 'webllm', 'cpu', 'prompt-api', 'endpoint'];

/** The runtime to keep. Older records are read like this:
 *  - before version 2, Chrome's built-in model could stay selected without the user choosing it
 *    (the owner's first test, 13 Nov 2026), so it goes back to the default once;
 *  - before version 3, "webllm" with no model named was the stored default, not a choice, so it
 *    becomes automatic; a named graphics-card model, the processor and an endpoint stay. */
function runtime(raw: Raw): RuntimeChoice {
  const value = pick(raw.runtime, RUNTIMES, DEFAULT_SETTINGS.runtime);
  const version = typeof raw.version === 'number' ? raw.version : 1;
  if (value === 'prompt-api' && version < 2) return 'auto';
  if (value === 'webllm' && version < 3 && !WEBLLM_MODEL_IDS.includes(String(raw.webllmModel))) {
    return 'auto';
  }
  return value;
}

export function normalizeSettings(value: unknown): Settings {
  const raw = asRecord(value);
  const d = DEFAULT_SETTINGS;
  return {
    version: SETTINGS_VERSION,
    runtime: runtime(raw),
    webllmModel: pick(raw.webllmModel, WEBLLM_MODEL_IDS, d.webllmModel),
    cpuModel: cpuModel(raw.cpuModel),
    endpoint: endpoint(raw.endpoint),
    maxSteps: steps(raw.maxSteps),
    confirmMode: pick(raw.confirmMode, ['every-call', 'per-site'], d.confirmMode),
    memory: typeof raw.memory === 'boolean' ? raw.memory : d.memory,
    siteFacts: typeof raw.siteFacts === 'boolean' ? raw.siteFacts : d.siteFacts,
    language: pick(raw.language, ['en'], d.language),
  };
}

export async function loadSettings(area: StorageAreaLike): Promise<Settings> {
  return normalizeSettings((await area.get(SETTINGS_KEY))[SETTINGS_KEY]);
}

export async function saveSettings(area: StorageAreaLike, settings: Settings): Promise<Settings> {
  const clean = normalizeSettings(settings);
  await area.set({ [SETTINGS_KEY]: clean });
  return clean;
}

export async function resetSettings(area: StorageAreaLike): Promise<void> {
  await area.remove(SETTINGS_KEY);
}
