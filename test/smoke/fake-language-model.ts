// SPDX-License-Identifier: Apache-2.0
// A scripted `LanguageModel` for the smoke tests: headless Chromium has no built-in model, so
// the side panel page gets this stand-in before its own scripts run. It records every create()
// and prompt in `globalThis.__lm`, and plays the states and errors a test asks for.
// installFakeLanguageModel is serialised into the page: it must not use anything outside itself.
import type { Page } from '@playwright/test';

export interface FakeModelConfig {
  /** What availability() answers (and what create() assumes about the download). */
  state: 'available' | 'downloadable';
  contextWindow: number;
  /** Replies, in order; the last one repeats. */
  replies: string[];
  /** create() rejects with this error (name, message) instead of making a session. */
  failCreate?: { name: string; message: string; requested?: number; contextWindow?: number };
  /** create() waits for the download for this long (ms), reporting progress, or forever. */
  downloadMs?: number | 'forever';
}

export interface FakeModelLog {
  creates: { initialPrompts?: { role: string; content: string }[]; active: boolean }[];
  prompts: { input: string; constraint?: unknown; omit?: boolean }[];
  aborted: number;
  destroyed: number;
}

export function installFakeLanguageModel(config: FakeModelConfig): void {
  const log = { creates: [], prompts: [], aborted: 0, destroyed: 0 } as FakeModelLog;
  (globalThis as { __lm?: FakeModelLog }).__lm = log;
  let reply = 0;
  const wait = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
  const downloading = async (options: Record<string, unknown>): Promise<void> => {
    const signal = options.signal as AbortSignal | undefined;
    signal?.addEventListener('abort', () => (log.aborted += 1));
    const monitor = new EventTarget();
    (options.monitor as ((m: EventTarget) => void) | undefined)?.(monitor);
    for (const loaded of [0.3, 0.6, 1]) {
      await wait(150);
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }));
    }
    if (config.downloadMs === 'forever') {
      await new Promise((_, reject) =>
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      );
    }
  };
  const session = {
    contextWindow: config.contextWindow,
    destroy: () => (log.destroyed += 1),
    promptStreaming: (input: string, options?: Record<string, unknown>) => {
      log.prompts.push({
        input,
        constraint: options?.responseConstraint,
        omit: options?.omitResponseConstraintInput as boolean | undefined,
      });
      const text = config.replies[Math.min(reply++, config.replies.length - 1)] ?? '';
      return (async function* () {
        await Promise.resolve();
        yield text;
      })();
    },
  };
  (globalThis as { LanguageModel?: unknown }).LanguageModel = {
    availability: () => Promise.resolve(config.state),
    create: async (options: Record<string, unknown> = {}) => {
      log.creates.push({
        active: navigator.userActivation.isActive,
        ...(options.initialPrompts
          ? { initialPrompts: options.initialPrompts as { role: string; content: string }[] }
          : {}),
      });
      if (config.failCreate) {
        throw Object.assign(new DOMException(config.failCreate.message, config.failCreate.name), {
          requested: config.failCreate.requested,
          contextWindow: config.failCreate.contextWindow,
        });
      }
      if (config.state === 'downloadable' && options.monitor) await downloading(options);
      return session;
    },
  };
}

/** Gives the panel page the fake before its scripts run (pass to `openPanelFor` as `before`). */
export function withFakeModel(config: FakeModelConfig): (panel: Page) => Promise<void> {
  return async (panel) => {
    await panel.addInitScript(installFakeLanguageModel, config);
  };
}

export const readLog = (panel: Page): Promise<FakeModelLog> =>
  panel.evaluate(() => (globalThis as unknown as { __lm: FakeModelLog }).__lm);
