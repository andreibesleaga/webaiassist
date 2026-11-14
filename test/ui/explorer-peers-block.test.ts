// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeerChoice } from '../../src/adapters/peers';
import { renderPeersBlock, tickedOrigins } from '../../src/ui/explorer/peers-block';

const CHOICES: PeerChoice[] = [
  { origin: 'https://patterns.example', allowed: true },
  { origin: 'http://127.0.0.2', allowed: false, why: 'not-https' },
  { origin: 'https://1.2.3.4', allowed: false, why: 'ip' },
];

beforeEach(() => {
  document.body.replaceChildren();
});

function mount(choices: readonly PeerChoice[] = CHOICES) {
  const read = vi.fn();
  const block = renderPeersBlock(document, choices, read);
  document.body.append(block);
  const boxes = Array.from(block.querySelectorAll<HTMLInputElement>('input'));
  const button = block.querySelector('button') as HTMLButtonElement;
  return { block, boxes, button, read };
}

describe('the peers block', () => {
  it('lists every peer, unticked, and only an allowed one can be ticked', () => {
    const { block, boxes } = mount();
    expect(boxes.map((box) => box.checked)).toEqual([false, false, false]);
    expect(boxes.map((box) => box.disabled)).toEqual([false, true, true]);
    expect(block.textContent).toContain('This node names 3 other nodes');
    expect(block.textContent).toContain('127.0.0.2 (not https)');
    expect(block.textContent).toContain('1.2.3.4 (an IP address)');
    expect(block.textContent).toContain('That node sees your IP address');
  });

  it('reads nothing until the button is pressed, and the button needs a ticked node', () => {
    const { boxes, button, read } = mount();
    expect(button.disabled).toBe(true);
    boxes[0]?.click();
    expect(button.disabled).toBe(false);
    expect(read).not.toHaveBeenCalled();
    button.click();
    expect(read).toHaveBeenCalledWith(['https://patterns.example']);
    boxes[0]?.click();
    expect(button.disabled).toBe(true);
  });

  it('labels each box with its address, so a click on the text ticks it', () => {
    const { boxes } = mount();
    const label = document.querySelector(`label[for="${boxes[0]?.id}"]`);
    expect(label?.textContent).toBe('https://patterns.example');
    (label as HTMLElement).click();
    expect(boxes[0]?.checked).toBe(true);
  });

  it('shows a hostile address as text, with hidden characters made visible', () => {
    const hostile = '<img src=x onerror=alert(1)>https://a.example‮';
    const { block, boxes } = mount([{ origin: hostile, allowed: false, why: 'invalid' }]);
    expect(block.querySelector('img')).toBeNull();
    expect(block.querySelector('label')?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(block.querySelector('label')?.textContent).toContain('[U+202E]');
    expect(boxes[0]?.disabled).toBe(true);
  });

  it('names the list and the block for a screen reader', () => {
    const { block } = mount();
    expect(block.getAttribute('aria-labelledby')).toBe('peers-heading');
    expect(block.querySelector('h2')?.id).toBe('peers-heading');
    expect(block.querySelector('ul')?.getAttribute('aria-label')).toBeTruthy();
    expect(tickedOrigins(block)).toEqual([]);
  });
});
