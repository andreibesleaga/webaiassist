// SPDX-License-Identifier: Apache-2.0
// What Chrome says about its built-in model (Prompt API, `LanguageModel`), in words the panel
// can show: the availability state, the requirements when it is "unavailable", and the exact
// error when create() fails. Requirements as on developer.chrome.com/docs/ai/prompt-api
// (last updated 21 Oct 2026, read 13 Nov 2026).

/** The options create() and availability() both get, as Chrome asks: the same on both. */
export const LANGUAGE_OPTIONS = Object.freeze({
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});

export const REQUIREMENTS =
  'Chrome’s built-in model needs official Google Chrome (not Chromium), Windows 10 or 11, ' +
  'macOS 13+, Linux or a Chromebook Plus; 22 GB free disk on the profile’s drive; a GPU with ' +
  'more than 4 GB of memory, or 16 GB RAM and 4 CPU cores; an unmetered network for the ' +
  'download. Users report that Chrome removes the model after 30 days without use.';

export const ABSENT = 'Chrome’s built-in model is not in this browser (no Prompt API here).';

const LANGUAGE_LINE =
  'Chrome’s built-in model does not support this language; use a downloaded model.';

/** True when `lm` has the two functions this adapter calls (not just a global of that name). */
export function hasPromptApi(lm: unknown): boolean {
  if (typeof lm !== 'object' && typeof lm !== 'function') return false;
  const api = lm as { availability?: unknown; create?: unknown } | null;
  return typeof api?.availability === 'function' && typeof api.create === 'function';
}

/** What each availability state means for the user, while the panel waits for Chrome. */
export function stateReason(state: string): string {
  switch (state) {
    case 'downloadable':
      return 'Chrome’s model is not on this computer yet; this click starts the download.';
    case 'downloading':
      return 'Chrome is downloading its model.';
    case 'available':
      return 'Chrome’s model is on this computer; starting it…';
    case 'unavailable':
      return `Chrome has not accepted the request yet; waiting for its answer. ${REQUIREMENTS}`;
    default:
      return 'Asking Chrome for its built-in model…';
  }
}

export interface AvailabilityLike {
  availability(options?: object): Promise<string>;
}

const describe = (error: unknown): string => {
  if (error instanceof Error)
    return error.name === 'Error' ? error.message : `${error.name}: ${error.message}`;
  return String(error);
};

/** Chrome's state, or "unknown (why)" when availability() fails. */
export async function readState(lm: AvailabilityLike): Promise<string> {
  try {
    return await lm.availability(LANGUAGE_OPTIONS);
  } catch (error) {
    return `unknown (${describe(error)})`;
  }
}

/** The error the panel shows when create() fails: Chrome's own words, its state, the fix. */
export function explainFailure(error: unknown, state: string): Error {
  const parts = [
    `Chrome did not start its built-in model: ${describe(error)} (Chrome's state: ${state}).`,
  ];
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') {
    parts.push('Chrome starts the download only from a click: press Start again.');
  }
  if (name === 'NetworkError') {
    parts.push(
      'The download did not finish: check the network (Chrome wants an unmetered one) and the ' +
        'free disk space, then press Start again.',
    );
  }
  if (isLanguageError(error)) parts.push(LANGUAGE_LINE);
  else if (state === 'unavailable') parts.push(REQUIREMENTS);
  return new Error(parts.join(' '));
}

/** Chrome refuses a language it has no model for with a NotSupportedError that names it. */
export function isLanguageError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === 'NotSupportedError' && /language/i.test(error.message)
  );
}

export const isQuotaError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'QuotaExceededError';

const numberField = (error: unknown, field: string): number | undefined => {
  const value = (error as Record<string, unknown> | null)?.[field];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
};

/** Tokens Chrome says the input needs, and the window it has, when the error carries them. */
export function quotaNumbers(error: unknown): { requested?: number; contextWindow?: number } {
  const requested = numberField(error, 'requested');
  const contextWindow = numberField(error, 'contextWindow') ?? numberField(error, 'quota');
  return { ...(requested ? { requested } : {}), ...(contextWindow ? { contextWindow } : {}) };
}

/** The error the panel shows when a question to the loaded model fails. */
export function explainChatFailure(error: unknown): Error {
  if (isLanguageError(error)) return new Error(LANGUAGE_LINE);
  if (isQuotaError(error)) {
    const { requested, contextWindow } = quotaNumbers(error);
    const size =
      requested && contextWindow ? ` (${requested} tokens needed, ${contextWindow} fit)` : '';
    return new Error(
      `The question and the page's tools are too long for Chrome's built-in model${size}. ` +
        'Ask something shorter, clear the chat, or use a downloaded model.',
    );
  }
  if (error instanceof Error && error.name === 'AbortError') return error;
  return new Error(`Chrome's built-in model failed: ${describe(error)}`);
}

export function unavailableError(): Error {
  return new Error(
    `Chrome says its built-in model is unavailable on this computer. ${REQUIREMENTS}`,
  );
}

export type BuiltInState =
  'absent' | 'unavailable' | 'downloadable' | 'downloading' | 'available' | 'unknown';

/** The state for the panel's line about Chrome's built-in model; never starts a download. */
export async function builtInState(lm: AvailabilityLike | undefined): Promise<BuiltInState> {
  if (!lm) return 'absent';
  const state = await readState(lm);
  const known = ['unavailable', 'downloadable', 'downloading', 'available'];
  return known.includes(state) ? (state as BuiltInState) : 'unknown';
}
