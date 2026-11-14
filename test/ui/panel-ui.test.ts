// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { PanelUI } from '../../src/ui/panel-ui';
import { tool } from '../helpers';
import { byId, click, key, loadPage, tick } from './dom';

const ORIGIN = 'https://node.example';

describe('PanelUI (the ChatUI port in the side panel)', () => {
  let ui: PanelUI;
  beforeEach(() => {
    loadPage('sidepanel.html');
    ui = new PanelUI(document);
  });

  it('shows the user text and the answer in the log, and keeps them for export', () => {
    ui.addUser('What is a handoff?');
    ui.show({ kind: 'answer', text: 'It passes work on.' });
    const items = [...byId('transcript').querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['YouWhat is a handoff?', 'WebAIAssistIt passes work on.']);
    expect(ui.entries).toEqual([
      { kind: 'user', text: 'What is a handoff?' },
      { kind: 'answer', text: 'It passes work on.' },
    ]);
  });

  it('marks a tool result as untrusted page content and never parses it as HTML', () => {
    ui.show({ kind: 'tool-result', name: 'read', ok: true, text: '<img src=x onerror=alert(1)>' });
    const item = byId('transcript').querySelector('li');
    expect(item?.dataset.trust).toBe('untrusted');
    expect(item?.classList.contains('untrusted')).toBe(true);
    expect(item?.title).toMatch(/^Untrusted content from the page/);
    expect(item?.querySelector('summary')?.textContent).toBe('Result of read (from the page)');
    expect(item?.querySelector('img')).toBeNull();
    expect(item?.querySelector('pre')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('shows a failed result, a tool call, a denial and an error', () => {
    ui.show({ kind: 'tool-call', name: 'search', args: { query: 'x' } });
    ui.show({ kind: 'tool-result', name: 'search', ok: false, text: 'no' });
    ui.show({ kind: 'tool-denied', name: 'propose' });
    ui.show({ kind: 'error', text: 'Stopped.' });
    const text = byId('transcript').textContent ?? '';
    expect(text).toContain('Calls the tool search with:');
    expect(text).toContain('"query": "x"');
    expect(text).toContain('Result of search (failed; from the page)');
    expect(text).toContain('You denied the call to propose.');
    expect(text).toContain('Error: Stopped.');
  });

  it('shows a note of the loop as one plain line, marked as a note', () => {
    ui.show({ kind: 'note', text: '<b>The assistant repeated a call.</b>' });
    const item = byId('transcript').querySelector('li');
    expect(item?.classList.contains('note')).toBe(true);
    expect(item?.textContent).toBe('<b>The assistant repeated a call.</b>');
    expect(item?.querySelector('b')).toBeNull();
  });

  it('streams the draft and clears it when the answer arrives', () => {
    ui.showDraft('It pa');
    expect(byId('draft').textContent).toBe('It pa');
    ui.show({ kind: 'answer', text: 'It passes.' });
    expect(byId('draft').textContent).toBe('');
  });

  it('shows download progress in the bar and the status line', () => {
    ui.showProgress({ fraction: 0.4, text: 'Fetching 40%' });
    expect(byId<HTMLProgressElement>('progress').value).toBe(0.4);
    expect(byId('model-status').textContent).toBe('Fetching 40%');
  });

  it('moves the bar on every step but changes the status line once per ten percent', () => {
    const line = () => byId('model-status').textContent;
    const bar = () => byId<HTMLProgressElement>('progress').value;
    ui.showProgress({ fraction: 0, text: 'Loading X…' });
    ui.showProgress({ fraction: 0.04, text: 'Downloading 4%' });
    ui.showProgress({ fraction: 0.07, text: 'Downloading 7%' });
    expect([bar(), line()]).toEqual([0.07, 'Downloading 4%']);
    ui.showProgress({ fraction: 0.1, text: 'Downloading 10%' });
    expect(line()).toBe('Downloading 10%');
    ui.showProgress({ fraction: 0.19, text: 'Downloading 19%' });
    expect(line()).toBe('Downloading 10%');
    ui.showProgress({ fraction: 0.2, text: 'Downloading 20%' });
    expect(line()).toBe('Downloading 20%');
  });

  it('always shows a message at 0 or 100 percent, and one written by something else', () => {
    const line = () => byId('model-status').textContent;
    ui.showProgress({ fraction: 0.5, text: 'Downloading 50%' });
    ui.showProgress({ fraction: 0.55, text: 'Downloading 55%' });
    expect(line()).toBe('Downloading 50%');
    ui.showProgress({ fraction: 0, text: 'The model did not load: no space' });
    expect(line()).toBe('The model did not load: no space');
    ui.showProgress({ fraction: 0.3, text: 'Downloading 30%' });
    ui.showProgress({ fraction: 1, text: 'Ready: X.' });
    expect(line()).toBe('Ready: X.');
  });

  it('puts a sign beside the warning of a tool that may change something', () => {
    void ui.confirmToolCall({ tool: tool('propose'), args: {}, origin: ORIGIN });
    const warning = document.querySelector('#confirm-body p.warning');
    expect(warning?.querySelector('.sign')?.getAttribute('aria-hidden')).toBe('true');
    expect(warning?.textContent).toContain('may change something');
    ui.cancelDialog();
  });

  it('shows no sign for a tool the page marks as read-only', () => {
    void ui.confirmToolCall({
      tool: {
        name: 'lookup',
        description: 'Looks up.',
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      args: {},
      origin: ORIGIN,
    });
    expect(document.querySelector('#confirm-body .sign')).toBeNull();
    ui.cancelDialog();
  });

  it('asks before a tool call: tool, site, arguments; Allow once resolves true', async () => {
    byId('question').focus();
    const answer = ui.confirmToolCall({
      tool: tool('propose'),
      args: { slug: 'a' },
      origin: ORIGIN,
    });
    expect(byId('confirm-title').textContent).toBe('Run the tool propose?');
    const body = byId('confirm-body').textContent ?? '';
    expect(body).toContain('Site: https://node.example');
    expect(body).toContain('"slug": "a"');
    expect(body).toContain('may change something');
    expect(document.activeElement?.id).toBe('confirm-deny');
    click('confirm-allow');
    expect(await answer).toBe(true);
    expect(byId<HTMLDialogElement>('confirm').open).toBe(false);
    expect(document.activeElement?.id).toBe('question');
  });

  it('says when the page marks a tool read-only; Deny resolves false', async () => {
    const answer = ui.confirmToolCall({ tool: tool('search'), args: {}, origin: ORIGIN });
    expect(byId('confirm-body').textContent).toContain('marks this tool as read-only');
    click('confirm-deny');
    expect(await answer).toBe(false);
  });

  it('treats Escape as Deny and keeps Tab inside the dialog', async () => {
    const answer = ui.confirmToolCall({ tool: tool('search'), args: {}, origin: ORIGIN });
    const dialog = byId('confirm');
    key(byId('confirm-allow'), 'Tab');
    expect(document.activeElement?.id).toBe('confirm-deny');
    key(byId('confirm-deny'), 'Tab', { shiftKey: true });
    expect(document.activeElement?.id).toBe('confirm-allow');
    key(dialog, 'Escape');
    expect(await answer).toBe(false);
  });

  it('answers Deny when the run is stopped while the dialog is open', async () => {
    const answer = ui.confirmToolCall({ tool: tool('search'), args: {}, origin: ORIGIN });
    ui.cancelDialog();
    expect(await answer).toBe(false);
    ui.cancelDialog();
    await tick();
  });

  it('asks once for a site with its tool count; Allow for this session resolves true', async () => {
    const answer = ui.confirmSite({ origin: ORIGIN, toolCount: 10 });
    expect(byId('confirm-title').textContent).toBe('Use the tools of https://node.example?');
    expect(byId('confirm-body').textContent).toContain('10 tools');
    expect(byId('confirm-allow').textContent).toBe('Allow for this session');
    click('confirm-allow');
    expect(await answer).toBe(true);
  });
});
