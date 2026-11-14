// SPDX-License-Identifier: Apache-2.0
// UI text lookup. Pages carry data-i18n="key" (text) and data-i18n-label="key"
// (aria-label) attributes; applyI18n fills them from the dictionary of the chosen language.
import { EN, type MessageKey } from './messages-en';

export type Dictionary = Readonly<Record<MessageKey, string>>;

const DICTIONARIES: Readonly<Record<string, Dictionary>> = { en: EN };

let current: Dictionary = EN;

export function setLanguage(language: string): void {
  current = DICTIONARIES[language] ?? EN;
}

/** The text for `key`, with {name} placeholders filled from `values`. */
export function t(key: MessageKey, values: Readonly<Record<string, string | number>> = {}): string {
  return current[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

function isKey(value: string | undefined): value is MessageKey {
  return value !== undefined && value in current;
}

export function applyI18n(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (isKey(key)) element.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((element) => {
    const key = element.dataset.i18nLabel;
    if (isKey(key)) element.setAttribute('aria-label', t(key));
  });
}
