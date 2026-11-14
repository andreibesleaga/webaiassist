// SPDX-License-Identifier: Apache-2.0
// What one scenario holds: the browser session, the web page under test, the side panel and
// the Options page, and the network requests when a scenario asks to record them.
import type { Download, Page } from '@playwright/test';
import type { FakeModelConfig } from '../smoke/fake-language-model';
import { startSession, type Session } from '../smoke/harness';

export class World {
  private started: Session | undefined;
  tabId: number | undefined;
  page: Page | undefined;
  panel: Page | undefined;
  options: Page | undefined;
  /** The page is served at localhost, where the extension has no access until it is given. */
  notAllowedYet = false;
  noBuiltInModel = false;
  /** A scripted LanguageModel for the side panel (headless Chromium has none). */
  builtIn: FakeModelConfig | undefined;
  /** How many "Run the tool …?" questions the step that allows questions has answered. */
  toolQuestions = 0;
  readonly requests: string[] = [];
  /** The page the steps look at: the Options page once it was opened, else the side panel. */
  private focused: 'panel' | 'options' = 'panel';
  download: Download | undefined;
  tabs: { ids: string[]; shown: boolean[] } | undefined;
  /** Pages the steps opened for switching: by the name the feature uses. */
  readonly pages = new Map<string, { page: Page; tabId: number; origin: string }>();
  /** The id of the second browser window a scenario opened. */
  windowId: number | undefined;
  /** The host of the other site the last switch went to. */
  otherHost = '';
  /** How many requests the test server had when the scenario's page was opened. */
  hitsBefore = 0;

  async session(): Promise<Session> {
    this.started ??= await startSession();
    return this.started;
  }

  async close(): Promise<void> {
    await this.started?.close();
  }

  /** The origin of the page under test. */
  async origin(): Promise<string> {
    const session = await this.session();
    return this.notAllowedYet ? session.localOrigin : session.origin;
  }

  /** "{host}" and "{origin}" in a step's text stand for the page under test. */
  async fill(text: string): Promise<string> {
    const origin = await this.origin();
    return text.replaceAll('{origin}', origin).replaceAll('{host}', new URL(origin).host);
  }

  requirePanel(): Page {
    if (!this.panel) throw new Error('the side panel is not open: add a Given step for it');
    return this.panel;
  }

  /** The page the next step acts on. */
  target(): Page {
    if (this.focused === 'options' && this.options) return this.options;
    return this.requirePanel();
  }

  focusOn(which: 'panel' | 'options'): void {
    this.focused = which;
  }
}
