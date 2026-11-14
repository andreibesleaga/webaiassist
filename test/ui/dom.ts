// SPDX-License-Identifier: Apache-2.0
// Loads a static page of the extension into the jsdom document and fills its texts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyI18n } from '../../src/ui/i18n';

export function loadPage(file: 'sidepanel.html' | 'options.html'): Document {
  const html = readFileSync(join(process.cwd(), 'static', file), 'utf8');
  document.open();
  document.write(html.replace(/<script[^>]*><\/script>/g, ''));
  document.close();
  applyI18n(document);
  return document;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`no #${id}`);
  return element as T;
}

export function click(id: string): void {
  byId(id).click();
}

export function key(target: EventTarget, keyName: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, ...init }));
}

export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
