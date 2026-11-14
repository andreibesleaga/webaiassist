// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { renderEntry } from '../../src/ui/transcript-view';

beforeEach(() => {
  document.body.replaceChildren();
});

describe('transcript lines', () => {
  it('gives each side its class and labels the assistant as an AI', () => {
    const user = renderEntry(document, { kind: 'user', text: 'Hi' });
    const answer = renderEntry(document, { kind: 'answer', text: 'Hello' });
    expect(user.className).toBe('user');
    expect(user.querySelector('.who')?.getAttribute('data-ai')).toBeNull();
    expect(answer.className).toBe('assistant');
    // The visible name stays plain; the AI label is drawn from the attribute.
    expect(answer.querySelector('.who')?.textContent).toBe('WebAIAssist');
    expect(answer.querySelector('.who')?.getAttribute('data-ai')).toBe('AI');
    expect(answer.querySelector('.who')?.getAttribute('title')).toMatch(/can be wrong/);
  });

  it('leaves a short tool call as it is', () => {
    const call = renderEntry(document, { kind: 'tool-call', name: 'add', args: { a: 1 } });
    expect(call.classList.contains('tool')).toBe(true);
    expect(call.querySelector('button')).toBeNull();
  });

  it('collapses a long tool call after six lines and opens it with a button', () => {
    const args = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i]));
    const call = renderEntry(document, { kind: 'tool-call', name: 'add', args });
    document.body.append(call);
    const pre = call.querySelector('pre') as HTMLElement;
    const button = call.querySelector('button') as HTMLButtonElement;
    expect(pre.classList.contains('clamped')).toBe(true);
    expect(button.textContent).toBe('Show all');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(pre.id);
    button.click();
    expect(pre.classList.contains('clamped')).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toBe('Show less');
    button.click();
    expect(pre.classList.contains('clamped')).toBe(true);
  });
});
