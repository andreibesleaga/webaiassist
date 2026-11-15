// SPDX-License-Identifier: Apache-2.0
// Declarative WebMCP tools: a `<form toolname="...">` of the page. The MAIN-world script reads
// the form from the page's own DOM to say two things the browser's tool list does not: does the
// page wait for the person to press Submit (no `toolautosubmit`), and does the form hold fields
// for a password, a payment or personal data. Both are shown to the user as a warning only; a
// page can write anything here, so neither is a security boundary and neither is sent to the model.
import type { WireForm } from '../protocol/messages';

/** The part of an element this reader uses; a real HTMLElement fits. */
export interface ElementLike {
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
}

/** The part of a document this reader uses. */
export interface DocumentLike {
  querySelectorAll(selector: string): ArrayLike<ElementLike>;
}

type Kind = WireForm['sensitive'][number];

const PAYMENT_AUTOCOMPLETE = /\bcc-(number|csc|exp|name|type)/;
const PAYMENT_NAME = /card|cvv|cvc|iban|expir|routing|account.?number/i;
const PERSONAL_AUTOCOMPLETE =
  /\b(name|given-name|family-name|email|tel|street-address|address-line1|postal-code|bday|username)\b/;
const PERSONAL_NAME =
  /ssn|social.?security|passport|birth|dob|address|phone|e-?mail|first.?name|last.?name|full.?name/i;
const PERSONAL_TYPE = new Set(['email', 'tel', 'date']);

const isPassword = (type: string, autocomplete: string): boolean =>
  type === 'password' || autocomplete.includes('password');

const isPayment = (autocomplete: string, name: string): boolean =>
  PAYMENT_AUTOCOMPLETE.test(autocomplete) || PAYMENT_NAME.test(name);

const isPersonal = (type: string, autocomplete: string, name: string): boolean =>
  PERSONAL_TYPE.has(type) || PERSONAL_AUTOCOMPLETE.test(autocomplete) || PERSONAL_NAME.test(name);

/** The sensitive kind of one control, from its type, autocomplete word and name; or none. */
function kindOf(control: ElementLike): Kind | undefined {
  const type = (control.getAttribute('type') ?? '').toLowerCase();
  const autocomplete = (control.getAttribute('autocomplete') ?? '').toLowerCase();
  const name = `${control.getAttribute('name') ?? ''} ${control.getAttribute('id') ?? ''}`;
  if (isPassword(type, autocomplete)) return 'password';
  if (isPayment(autocomplete, name)) return 'payment';
  return isPersonal(type, autocomplete, name) ? 'personal' : undefined;
}

const ORDER: readonly Kind[] = ['password', 'payment', 'personal'];

/** The kinds of sensitive fields a form holds, in a fixed order. */
export function sensitiveKinds(form: ElementLike): Kind[] {
  const found = new Set<Kind>();
  for (const control of Array.from(form.querySelectorAll('input, select, textarea'))) {
    const kind = kindOf(control);
    if (kind) found.add(kind);
  }
  return ORDER.filter((kind) => found.has(kind));
}

/** What the page's forms say about their tools, by tool name (the first form with a name wins). */
export function formsByTool(doc: DocumentLike): Map<string, WireForm> {
  const out = new Map<string, WireForm>();
  for (const form of Array.from(doc.querySelectorAll('form[toolname]'))) {
    const name = form.getAttribute('toolname');
    if (!name || out.has(name)) continue;
    out.set(name, {
      autosubmit: form.hasAttribute('toolautosubmit'),
      sensitive: sensitiveKinds(form),
    });
  }
  return out;
}
