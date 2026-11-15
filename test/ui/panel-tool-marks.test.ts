// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The tools list shows the review marks, "for developers" and the form mark; a tool opens a
// detail view with every hint, the fields and the reasons; everything the page wrote is text.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageInfo } from '../../src/adapters/messaging-tool-bridge';
import type { ToolInfo } from '../../src/core/types';
import { byId, click, loadPage } from './dom';
import { fakeDeps, ORIGIN } from './panel-fakes';
import { fakeClock, open } from './site-helpers';

const page = (tools: ToolInfo[]): PageInfo => ({ origin: ORIGIN, linkset: false, tools });
const read = { readOnlyHint: true };

async function show(tools: ToolInfo[]): Promise<void> {
  const deps = fakeDeps([], {});
  deps.bridge.pageResult = page(tools);
  await open(deps);
}

const row = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('#tools-rows li')].find(
    (li) => li.querySelector('code')?.textContent === name,
  );
  if (!found) throw new Error(`no row ${name}`);
  return found;
};

describe('the tools list: marks from the review', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('marks a flagged tool "check" and writes the reason in the row', async () => {
    await show([
      { name: 'delete_account', description: 'Deletes it.', annotations: read },
      { name: 'account_deIete', description: 'A look-alike.', annotations: read },
      { name: 'list_items', description: 'Lists the items.', annotations: read },
    ]);
    expect(row('delete_account').textContent).toContain('check');
    expect(row('delete_account').textContent).toContain('Marked read-only');
    expect(row('account_deIete').textContent).toContain('look-alike');
    expect(row('list_items').textContent).not.toContain('check');
  });

  it('lists a tool for developers with a mark, a form tool with "form"', async () => {
    await show([
      { name: 'dev_dump', description: 'Dumps state.', annotations: { ...read, debugging: true } },
      {
        name: 'search_form',
        description: 'A form.',
        annotations: read,
        form: { autosubmit: false, sensitive: [] },
      },
    ]);
    expect(row('dev_dump').textContent).toContain('for developers');
    expect(row('search_form').textContent).toContain('form');
  });
});

describe('the tool detail view', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  const all: ToolInfo = {
    name: 'c05_all',
    title: 'Everything',
    description: 'Has every hint. Second sentence.',
    annotations: {
      readOnlyHint: true,
      consequentialHint: true,
      untrustedContentHint: true,
      debugging: true,
    },
    inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  };

  it('opens from the tool name and shows the full text, every hint and the schema', async () => {
    await show([all]);
    expect(row('c05_all').querySelector('.detail')).toBeNull();
    (row('c05_all').querySelector('button.open') as HTMLButtonElement).click();
    const detail = row('c05_all').querySelector('.detail') as HTMLElement;
    expect(detail.textContent).toContain('Everything');
    expect(detail.textContent).toContain('Second sentence.');
    expect(detail.textContent).toContain('debugging: yes');
    expect(detail.textContent).toContain('"q"');
    (row('c05_all').querySelector('button.open') as HTMLButtonElement).click();
    expect(row('c05_all').querySelector('.detail')).toBeNull();
  });

  it('shows the reasons and the form facts in the detail', async () => {
    await show([
      {
        name: 'login_form',
        description: 'A form.',
        annotations: read,
        form: { autosubmit: false, sensitive: ['password'] },
      },
      { name: 'send_it', description: 'Sends.', annotations: read },
    ]);
    (row('login_form').querySelector('button.open') as HTMLButtonElement).click();
    const text = row('login_form').querySelector('.detail')?.textContent ?? '';
    expect(text).toContain('The page waits for you to press Submit.');
    expect(text).toContain('password');
    (row('send_it').querySelector('button.open') as HTMLButtonElement).click();
    expect(row('send_it').querySelector('.detail')?.textContent).toContain('Marked read-only');
  });

  it('shows page text as text: no element comes from it, hidden characters are visible', async () => {
    await show([
      {
        name: 'x_tool',
        description: '<img src=x onerror=alert(1)> <b>bold​hidden',
        annotations: read,
        inputSchema: { type: 'object', properties: { '<i>f': { type: 'string' } } },
      },
    ]);
    (row('x_tool').querySelector('button.open') as HTMLButtonElement).click();
    const detail = row('x_tool').querySelector('.detail') as HTMLElement;
    expect(detail.querySelector('img, b, i, script')).toBeNull();
    expect(detail.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(detail.textContent).toContain('[U+200B]');
  });

  it('keeps the list closed unless asked, and the toggle still counts tools', async () => {
    await show([all]);
    expect(byId('tools-list').hidden).toBe(true);
    click('tools-toggle');
    expect(byId('tools-list').hidden).toBe(false);
  });
});
