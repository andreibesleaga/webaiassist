// SPDX-License-Identifier: Apache-2.0
// The error banner (#error-banner, role="alert") above the question box: one message at a time,
// the buttons that say what to do next, and Dismiss. Showing a new one replaces the old one.
import { byId, element } from './dom';

export interface BannerAction {
  readonly id: string;
  readonly label: string;
  run(): void | Promise<void>;
}

export function hideBanner(doc: Document): void {
  byId(doc, 'error-banner').hidden = true;
  byId(doc, 'error-text').textContent = '';
  byId(doc, 'error-actions').replaceChildren();
}

export function showBanner(doc: Document, text: string, actions: readonly BannerAction[]): void {
  byId(doc, 'error-text').textContent = text;
  byId(doc, 'error-actions').replaceChildren(
    ...actions.map((action) => {
      const button = element(doc, 'button', action.label);
      button.id = action.id;
      button.type = 'button';
      button.addEventListener('click', () => void action.run());
      return button;
    }),
  );
  byId(doc, 'error-banner').hidden = false;
}

export function bindBanner(doc: Document): void {
  byId(doc, 'error-dismiss').addEventListener('click', () => hideBanner(doc));
}
