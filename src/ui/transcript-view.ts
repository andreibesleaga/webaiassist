// SPDX-License-Identifier: Apache-2.0
// One transcript line per entry. Tool results are page content: they are shown in a
// collapsed block marked "untrusted" (class, data-trust and the title text), as plain text,
// and capped for display. The visible label stays plain: "Result of <tool> (from the page)".
import type { TranscriptEntry } from '../core/export';
import { redactArgs } from '../core/export';
import { revealInvisible } from '../core/sanitize';
import { element } from './dom';
import { t } from './i18n';

const DISPLAY_CAP = 20000;

function said(doc: Document, role: 'user' | 'assistant', who: string, text: string) {
  const item = element(doc, 'li', undefined, role);
  const label = element(doc, 'div', who, 'who');
  if (role === 'assistant') {
    // Drawn by CSS from these two attributes, so the label's own text stays the plain name.
    label.dataset.ai = t('aiLabel');
    label.title = t('aiLabelTitle');
  }
  item.append(label, element(doc, 'div', text));
  return item;
}

const CLAMP_LINES = 6;
let clampCount = 0;

/** A long block shows its first lines; a button opens the rest. Keyboard and screen reader safe. */
function clamped(doc: Document, block: HTMLElement, text: string): HTMLElement {
  if (text.split('\n').length <= CLAMP_LINES) return block;
  block.classList.add('clamped');
  block.id = `block-${(clampCount += 1)}`;
  const button = element(doc, 'button', t('showAll'), 'link');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', block.id);
  button.addEventListener('click', () => {
    const open = block.classList.toggle('clamped') === false;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = t(open ? 'showLess' : 'showAll');
  });
  const wrap = element(doc, 'div');
  wrap.append(block, button);
  return wrap;
}

function toolResult(doc: Document, name: string, ok: boolean, text: string): HTMLLIElement {
  const item = element(doc, 'li', undefined, 'untrusted');
  item.dataset.trust = 'untrusted';
  item.title = t('untrustedTitle');
  const details = element(doc, 'details');
  const shown = revealInvisible(name);
  const label = ok ? t('toolResult', { name: shown }) : t('toolFailed', { name: shown });
  details.append(element(doc, 'summary', label), element(doc, 'pre', text.slice(0, DISPLAY_CAP)));
  item.append(details);
  return item;
}

function toolCall(doc: Document, name: string, args: unknown): HTMLLIElement {
  const item = element(doc, 'li');
  const json = revealInvisible(JSON.stringify(redactArgs(args), null, 2));
  const label = t('toolCall', { name: revealInvisible(name) });
  item.classList.add('tool');
  item.append(element(doc, 'div', label), clamped(doc, element(doc, 'pre', json), json));
  return item;
}

export function renderEntry(doc: Document, entry: TranscriptEntry): HTMLLIElement {
  switch (entry.kind) {
    case 'user':
      return said(doc, 'user', t('you'), entry.text);
    case 'answer':
      return said(doc, 'assistant', t('assistant'), entry.text);
    case 'tool-call':
      return toolCall(doc, entry.name, entry.args);
    case 'tool-result':
      return toolResult(doc, entry.name, entry.ok, entry.text);
    case 'tool-denied':
      return element(doc, 'li', t('toolDenied', { name: revealInvisible(entry.name) }));
    case 'error':
      return element(doc, 'li', t('errorPrefix', { text: entry.text }));
    case 'note':
      return element(doc, 'li', entry.text, 'note');
  }
}
