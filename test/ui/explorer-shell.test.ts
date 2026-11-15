// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindLinkOpener } from '../../src/ui/explorer/link-opener';
import { startShell } from '../../src/ui/explorer/shell';
import { EXPLORER_TABS, type ExplorerContext, type ExplorerTab } from '../../src/ui/explorer/tabs';

const ctx = (): ExplorerContext => ({
  doc: document,
  target: { tabId: 1, origin: 'https://node.example' },
  readTab: () => Promise.resolve({ state: 'not-published' }),
  approved: new Set(),
});

function page() {
  document.body.innerHTML =
    '<div id="bar" role="tablist"></div><div id="panels"><div id="panel-graph"></div></div>';
  return {
    bar: document.getElementById('bar') as HTMLElement,
    host: document.getElementById('panels') as HTMLElement,
  };
}

beforeEach(() => document.body.replaceChildren());

describe('the explorer tab list', () => {
  it('ships the Graph, Query, Vocabulary, Page data and Activity tabs', () => {
    expect(EXPLORER_TABS.map((tab) => tab.id)).toEqual([
      'graph',
      'query',
      'vocab',
      'page-data',
      'activity',
    ]);
  });

  it('builds tabs with the roles and the one that is selected in the tab order', () => {
    const { bar, host } = page();
    const mount = vi.fn();
    const tabs: ExplorerTab[] = [
      { id: 'graph', labelKey: 'explorerTabGraph', mount },
      { id: 'two', labelKey: 'explorerTabGraph', mount },
    ];
    startShell(ctx(), tabs, bar, host);
    const buttons = Array.from(bar.querySelectorAll('button'));
    expect(buttons.map((button) => button.getAttribute('role'))).toEqual(['tab', 'tab']);
    expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
    ]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1]);
    const panels = Array.from(host.children) as HTMLElement[];
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true]);
    expect(panels[1]?.getAttribute('role')).toBe('tabpanel');
    expect(panels[1]?.getAttribute('aria-labelledby')).toBe('tab-two');
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it('moves with the arrow keys, Home and End, and shows the matching panel', () => {
    const { bar, host } = page();
    const mount = vi.fn();
    const tabs: ExplorerTab[] = ['graph', 'two', 'three'].map((id) => ({
      id,
      labelKey: 'explorerTabGraph',
      mount,
    }));
    startShell(ctx(), tabs, bar, host);
    const buttons = Array.from(bar.querySelectorAll('button'));
    const press = (index: number, key: string) =>
      buttons[index]?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    press(0, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
    expect(document.getElementById('panel-two')?.hidden).toBe(false);
    expect(document.getElementById('panel-graph')?.hidden).toBe(true);
    press(1, 'End');
    expect(document.activeElement).toBe(buttons[2]);
    press(2, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[0]);
    press(0, 'ArrowLeft');
    expect(document.activeElement).toBe(buttons[2]);
    press(2, 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    expect(press(0, 'x')).toBe(true);
  });
});

describe('links in the explorer', () => {
  it('open in a new tab and never navigate the explorer; other schemes open nothing', () => {
    document.body.innerHTML =
      '<a id="ok" href="https://a.example/x">a</a><a id="js" href="javascript:alert(1)">b</a><b id="no">c</b>';
    const open = vi.fn();
    bindLinkOpener(document, open);
    const ok = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('ok')?.dispatchEvent(ok);
    expect(ok.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith('https://a.example/x');
    const js = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('js')?.dispatchEvent(js);
    expect(js.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('no')?.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
  });
});
