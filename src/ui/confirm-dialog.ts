// SPDX-License-Identifier: Apache-2.0
// The one question dialog of the side panel: a modal <dialog> with Deny and Allow.
// Deny has the focus first; Escape means Deny; Tab stays inside; when it closes, the focus
// goes back to where it was. Stop answers Deny through cancel().
import { byId } from './dom';

export interface Question {
  readonly title: string;
  readonly body: readonly Node[];
  readonly allowLabel: string;
  readonly denyLabel: string;
}

export class ConfirmDialog {
  private finish: ((allowed: boolean) => void) | undefined;

  constructor(private readonly doc: Document) {}

  ask(question: Question): Promise<boolean> {
    this.cancel();
    const dialog = byId<HTMLDialogElement>(this.doc, 'confirm');
    const allow = byId<HTMLButtonElement>(this.doc, 'confirm-allow');
    const deny = byId<HTMLButtonElement>(this.doc, 'confirm-deny');
    byId(this.doc, 'confirm-title').textContent = question.title;
    byId(this.doc, 'confirm-body').replaceChildren(...question.body);
    allow.textContent = question.allowLabel;
    deny.textContent = question.denyLabel;
    const previous = this.doc.activeElement as HTMLElement | null;
    openDialog(dialog);
    deny.focus();
    return new Promise<boolean>((resolve) => {
      const onKey = (event: KeyboardEvent): void => trapKeys(event, allow, deny, this);
      const onCancel = (event: Event): void => {
        event.preventDefault();
        this.cancel();
      };
      const onAllow = (): void => this.finish?.(true);
      const onDeny = (): void => this.finish?.(false);
      this.finish = (allowed) => {
        this.finish = undefined;
        dialog.removeEventListener('keydown', onKey);
        dialog.removeEventListener('cancel', onCancel);
        allow.removeEventListener('click', onAllow);
        deny.removeEventListener('click', onDeny);
        closeDialog(dialog);
        previous?.focus();
        resolve(allowed);
      };
      dialog.addEventListener('keydown', onKey);
      dialog.addEventListener('cancel', onCancel);
      allow.addEventListener('click', onAllow);
      deny.addEventListener('click', onDeny);
    });
  }

  /** Closes an open question as Deny. */
  cancel(): void {
    this.finish?.(false);
  }
}

function trapKeys(
  event: KeyboardEvent,
  allow: HTMLButtonElement,
  deny: HTMLButtonElement,
  dialog: ConfirmDialog,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    dialog.cancel();
    return;
  }
  if (event.key !== 'Tab') return;
  // Two buttons: Tab and Shift+Tab both move to the other one.
  event.preventDefault();
  (event.target === deny ? allow : deny).focus();
}

function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}
