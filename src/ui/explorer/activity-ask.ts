// SPDX-License-Identifier: Apache-2.0
// A question inside the page (role "alertdialog"), for Clear and for a re-run. The explorer page
// has no dialog of the side panel, and the browser's confirm() is never used. One question at a
// time: a new one answers the old one "no". The focus goes to the safe button.
import { element } from '../dom';

export interface Asking {
  readonly text: string;
  readonly yes: string;
  readonly no: string;
}

const askers = new WeakMap<HTMLElement, (asking: Asking) => Promise<boolean>>();

/** The asker of `host`; the same one every time, so a new question reaches the old one. */
export function createAsker(
  doc: Document,
  host: HTMLElement,
): (asking: Asking) => Promise<boolean> {
  const known = askers.get(host);
  if (known) return known;
  let close: ((answer: boolean) => void) | undefined;
  const asker = (asking: Asking): Promise<boolean> => {
    close?.(false);
    const box = element(doc, 'div', undefined, 'activity-ask');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'false');
    const text = element(doc, 'p', asking.text);
    text.id = `activity-ask-text-${host.childElementCount}`;
    box.setAttribute('aria-labelledby', text.id);
    const yes = element(doc, 'button', asking.yes);
    const no = element(doc, 'button', asking.no);
    yes.type = 'button';
    no.type = 'button';
    box.append(text, yes, no);
    host.replaceChildren(box);
    no.focus();
    return new Promise((resolve) => {
      const done = (answer: boolean): void => {
        close = undefined;
        box.remove();
        resolve(answer);
      };
      close = done;
      yes.addEventListener('click', () => done(true));
      no.addEventListener('click', () => done(false));
      box.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') done(false);
      });
    });
  };
  askers.set(host, asker);
  return asker;
}
