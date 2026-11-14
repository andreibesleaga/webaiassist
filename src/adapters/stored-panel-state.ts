// SPDX-License-Identifier: Apache-2.0
// What the side panel remembers besides the Options: whether the welcome screen was dismissed
// and the measured first-answer time of the graphics card. One key in chrome.storage.local;
// every read goes through normalizePanelState, so a foreign value becomes a valid one.
import type { GpuMeasure } from './gpu-speed';
import type { StorageAreaLike } from './settings';

export const PANEL_STATE_KEY = 'panelState';

export interface StoredPanelState {
  readonly firstRunDone: boolean;
  readonly gpu?: GpuMeasure;
  /** The last error the panel showed, already cleaned and cut (src/core/diagnostics.ts). */
  readonly lastError?: string;
  /** Persistent storage was asked for once, after the first successful model download. */
  readonly persistAsked?: boolean;
  /** Hosts of remote chat endpoints the user agreed to use (src/ui/panel-consent.ts). */
  readonly endpointHosts?: readonly string[];
}

type Raw = Record<string, unknown>;
const asRecord = (value: unknown): Raw =>
  typeof value === 'object' && value !== null ? (value as Raw) : {};

function gpu(value: unknown): GpuMeasure | undefined {
  const raw = asRecord(value);
  const ms = raw.firstAnswerMs;
  if (typeof raw.key !== 'string' || raw.key.length > 200) return undefined;
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return undefined;
  return { key: raw.key, firstAnswerMs: Math.round(ms) };
}

const MAX_HOSTS = 50;

function hosts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value.filter((v): v is string => typeof v === 'string' && v.length <= 255);
  return [...new Set(names)].slice(-MAX_HOSTS);
}

export function normalizePanelState(value: unknown): StoredPanelState {
  const raw = asRecord(value);
  const measure = gpu(raw.gpu);
  const lastError = typeof raw.lastError === 'string' ? raw.lastError.slice(0, 300) : undefined;
  return {
    firstRunDone: raw.firstRunDone === true,
    ...(measure ? { gpu: measure } : {}),
    ...(lastError ? { lastError } : {}),
    ...(raw.persistAsked === true ? { persistAsked: true } : {}),
    ...(hosts(raw.endpointHosts).length > 0 ? { endpointHosts: hosts(raw.endpointHosts) } : {}),
  };
}

export async function loadPanelState(area: StorageAreaLike): Promise<StoredPanelState> {
  return normalizePanelState((await area.get(PANEL_STATE_KEY))[PANEL_STATE_KEY]);
}

/** Saves the fields named in `patch`; the others stay as they were. */
export async function savePanelState(
  area: StorageAreaLike,
  patch: Partial<StoredPanelState>,
): Promise<StoredPanelState> {
  const merged = normalizePanelState({ ...(await loadPanelState(area)), ...patch });
  await area.set({ [PANEL_STATE_KEY]: merged });
  return merged;
}
