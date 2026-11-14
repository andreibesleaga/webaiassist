// SPDX-License-Identifier: Apache-2.0
// Reads whether Chrome's Prompt API (`LanguageModel`, Gemini Nano) can be used here, for the
// spike page. It never starts a model download: create() is tried only when the model is
// already available, to read the size of the context window and which session functions exist.
import { LANGUAGE_OPTIONS } from './prompt-api-state';
import { errorText } from './webmcp-reader';

export interface PromptApiReport {
  present: boolean;
  availability?: string;
  params?: string;
  /** What a session offers: the window and the functions of the current API. */
  session?: string;
  error?: string;
}

interface SessionLike {
  contextWindow?: unknown;
  inputQuota?: unknown;
  clone?: unknown;
  measureContextUsage?: unknown;
  destroy(): void;
}

export interface LanguageModelLike {
  availability(options?: object): Promise<string>;
  params?(): Promise<unknown>;
  create?(options?: object): Promise<SessionLike>;
}

const shown = (value: unknown): string => (typeof value === 'number' ? String(value) : '-');
const kind = (value: unknown): string => (typeof value === 'function' ? 'yes' : 'no');

async function readSession(lm: LanguageModelLike): Promise<string> {
  if (!lm.create) return 'not read (no create())';
  try {
    const session = await lm.create({ ...LANGUAGE_OPTIONS });
    const text =
      `contextWindow ${shown(session.contextWindow)}, inputQuota ${shown(session.inputQuota)}, ` +
      `clone ${kind(session.clone)}, measureContextUsage ${kind(session.measureContextUsage)}`;
    session.destroy();
    return text;
  } catch (error) {
    return `create() failed: ${errorText(error)}`;
  }
}

async function readParams(lm: LanguageModelLike): Promise<string | undefined> {
  return lm.params ? JSON.stringify(await lm.params()) : undefined;
}

export async function probePromptApi(lm: LanguageModelLike | undefined): Promise<PromptApiReport> {
  if (!lm) return { present: false };
  try {
    const availability = await lm.availability(LANGUAGE_OPTIONS);
    const params = await readParams(lm);
    const session =
      availability === 'available' ? await readSession(lm) : 'not read (model not available yet)';
    return { present: true, availability, ...(params ? { params } : {}), session };
  } catch (error) {
    return { present: true, error: errorText(error) };
  }
}
