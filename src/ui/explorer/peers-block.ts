// SPDX-License-Identifier: Apache-2.0
// The block above the explorer that lists the other nodes this node names, with one checkbox
// each (unticked) and one button. Nothing is read from another node until the user ticks it and
// presses the button. The origins come from the node's linkset, so they are data: text only,
// with hidden characters made visible. Written by WebAIAssist; the site's own "Peers" checkbox is
// hidden by explorer.css and driven by graph-tab.ts after the button.
import { visible } from '../../core/tool-card';
import type { PeerChoice, PeerRefusal } from '../../adapters/peers';
import { element } from '../dom';
import { t } from '../i18n';
import type { MessageKey } from '../messages-en';

const WHY: Readonly<Record<PeerRefusal, MessageKey>> = {
  invalid: 'peersWhyInvalid',
  'not-https': 'peersWhyNotHttps',
  'user-info': 'peersWhyUserInfo',
  port: 'peersWhyPort',
  ip: 'peersWhyIp',
  local: 'peersWhyLocal',
  'no-dot': 'peersWhyNoDot',
};

const ORIGIN_CAP = 120;

function row(doc: Document, choice: PeerChoice, index: number, changed: () => void): HTMLLIElement {
  const item = element(doc, 'li');
  const box = element(doc, 'input');
  box.type = 'checkbox';
  box.id = `peer-${index}`;
  box.dataset.origin = choice.origin;
  box.disabled = !choice.allowed;
  box.addEventListener('change', changed);
  const label = element(doc, 'label');
  label.htmlFor = box.id;
  label.textContent = visible(choice.origin).slice(0, ORIGIN_CAP);
  item.append(box, label);
  if (choice.why !== undefined)
    item.append(element(doc, 'span', ` (${t(WHY[choice.why])})`, 'why'));
  return item;
}

/** The origins whose box is ticked. */
export function tickedOrigins(block: ParentNode): string[] {
  const boxes = Array.from(block.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  return boxes.filter((box) => box.checked).map((box) => box.dataset.origin ?? '');
}

/** The block; `onRead` gets the ticked origins when the button is pressed. */
export function renderPeersBlock(
  doc: Document,
  choices: readonly PeerChoice[],
  onRead: (origins: string[]) => void,
): HTMLElement {
  const block = element(doc, 'section', undefined, 'peers');
  block.setAttribute('aria-labelledby', 'peers-heading');
  const heading = element(doc, 'h2', t('peersHeading'));
  heading.id = 'peers-heading';
  const button = element(doc, 'button', t('peersRead'));
  button.type = 'button';
  button.disabled = true;
  const changed = (): void => {
    button.disabled = tickedOrigins(block).length === 0;
  };
  const list = element(doc, 'ul');
  list.setAttribute('aria-label', t('peersListLabel'));
  list.append(...choices.map((choice, index) => row(doc, choice, index, changed)));
  button.addEventListener('click', () => onRead(tickedOrigins(block)));
  block.append(
    heading,
    element(doc, 'p', t('peersIntro', { count: choices.length })),
    list,
    button,
  );
  return block;
}
