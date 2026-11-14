// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// axe-core on the side panel and the Options page in jsdom. jsdom has no layout, so the
// colour-contrast rule cannot run here; the real-browser axe run covers it.
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { PanelUI } from '../../src/ui/panel-ui';
import { buildLists, fillForm } from '../../src/ui/options-form';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { tool } from '../helpers';
import { byId, loadPage } from './dom';

async function violations(): Promise<string[]> {
  const result = await axe.run(document, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

describe('accessibility (axe-core in jsdom)', () => {
  it('finds a real problem when one is planted (the check can fail)', async () => {
    loadPage('sidepanel.html');
    byId('ask').append(Object.assign(document.createElement('input'), { type: 'text' }));
    expect((await violations()).join('\n')).toMatch(/^label:/m);
  });

  it('side panel with a conversation has no violations', async () => {
    loadPage('sidepanel.html');
    const ui = new PanelUI(document);
    ui.addUser('What is a handoff?');
    ui.show({ kind: 'tool-call', name: 'search', args: { query: 'handoff' } });
    ui.show({ kind: 'tool-result', name: 'search', ok: true, text: '{"items":[]}' });
    ui.show({ kind: 'answer', text: 'It passes work on.' });
    byId('help').hidden = false;
    expect(await violations()).toEqual([]);
  });

  it('side panel with the confirmation dialog open has no violations', async () => {
    loadPage('sidepanel.html');
    const ui = new PanelUI(document);
    void ui.confirmToolCall({
      tool: tool('propose'),
      args: { slug: 'a' },
      origin: 'https://n.example',
    });
    expect(await violations()).toEqual([]);
    ui.cancelDialog();
  });

  it('Options page has no violations', async () => {
    loadPage('options.html');
    buildLists(document);
    fillForm(document, DEFAULT_SETTINGS);
    expect(await violations()).toEqual([]);
  });
});
