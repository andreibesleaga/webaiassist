// SPDX-License-Identifier: Apache-2.0
// Small shapes shared by the tools list and the questions.
import { element } from './dom';

/** A shape as well as a colour: a tool that changes something carries a "!" in front of its word. */
export function sign(doc: Document): HTMLSpanElement {
  const mark = element(doc, 'span', '!', 'sign');
  mark.setAttribute('aria-hidden', 'true');
  return mark;
}
