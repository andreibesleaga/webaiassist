// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The Activity tab of the explorer page, with an in-memory log: totals, filters, the list with its
// tool calls and context numbers, the include-content switch, the two exports, Clear with an
// in-page question, and a re-run that runs only after Allow. Text only: a hostile value stays text.
import { Ajv2020 } from 'ajv/dist/2020';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_SCHEMA } from '../../src/core/activity-schema';
import type { ToolCall } from '../../src/core/ports/activity-log';
import type { ToolBridge } from '../../src/core/ports/tool-bridge';
import { InMemoryActivity } from '../../src/fakes/in-memory-activity';
import { activityTab, mountActivity, type ActivityDeps } from '../../src/ui/explorer/activity-tab';
import { record } from '../helpers-activity';

const ORIGIN = 'https://node.example';
const call: ToolCall = {
  name: 'c09_two_seconds',
  builtin: false,
  at: '2026-01-15T10:00:00.000Z',
  asked: true,
  decision: 'allowed',
  argNames: ['id'],
  argBytes: 8,
  durationMs: 2000,
  resultBytes: 12,
  ok: true,
  args: { id: 1 },
};

function setup(rows = [record({ id: 'a', tools: [call] })]) {
  const log = new InMemoryActivity();
  log.records = rows;
  const downloads: { name: string; text: string; mime: string }[] = [];
  const calls: unknown[] = [];
  const bridge: ToolBridge = {
    list: () =>
      Promise.resolve({
        origin: ORIGIN,
        tools: [{ name: 'c09_two_seconds', description: 'Waits' }],
      }),
    call: (_target, name, args) => {
      calls.push({ name, args });
      return Promise.resolve({ ok: true, text: 'waited' });
    },
    onChange: () => () => undefined,
  };
  const activity: ActivityDeps = {
    log,
    bridge,
    target: { tabId: 4, origin: ORIGIN },
    nowIso: () => '2026-01-20T08:00:00.000Z',
    download: (name, text, mime) => downloads.push({ name, text, mime }),
  };
  document.body.replaceChildren();
  const root = document.createElement('div');
  document.body.append(root);
  return { log, downloads, calls, activity, root };
}

const button = (root: HTMLElement, name: RegExp): HTMLButtonElement => {
  const found = Array.from(root.querySelectorAll('button')).find((b) => name.test(b.textContent));
  if (!found) throw new Error(`no button ${name}`);
  return found;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => document.body.replaceChildren());

describe('the Activity tab', () => {
  it('is a tab named Activity', () => {
    expect(activityTab.id).toBe('activity');
  });

  it('lists the entries in a log region with their tool calls and context numbers', async () => {
    const { root, activity } = setup();
    await mountActivity(root, { doc: document, activity });
    const log = root.querySelector('[role="log"]') as HTMLElement;
    expect(log.getAttribute('aria-label')).toMatch(/activity/i);
    expect(log.textContent).toContain('c09_two_seconds');
    expect(log.textContent).toContain('Qwen3 4B');
    const meter = log.querySelector('meter') as HTMLMeterElement;
    expect(meter.max).toBe(4096);
    expect(meter.value).toBe(620);
    expect(meter.getAttribute('aria-label')).toMatch(/620 of 4096 tokens \(estimated\)/);
    expect(root.querySelector('table')?.querySelector('th[scope="col"]')).not.toBeNull();
    expect(root.querySelector('h2')).not.toBeNull();
  });

  it('shows the totals, in all and per day', async () => {
    const { root, activity } = setup([
      record({ id: 'a', tools: [call] }),
      record({ id: 'b', day: '2026-01-16', at: '2026-01-16T09:00:00.000Z' }),
    ]);
    await mountActivity(root, { doc: document, activity });
    const totals = (root.querySelector('#activity-totals') as HTMLElement).textContent;
    expect(totals).toContain('All days');
    expect(totals).toContain('2026-01-15');
    expect(totals).toContain('2026-01-16');
    expect(totals).toMatch(/estimated/);
  });

  it('filters by site, model and day', async () => {
    const { root, activity } = setup([
      record({ id: 'a' }),
      record({ id: 'b', origin: 'https://b.example', model: 'Other', day: '2026-01-16' }),
    ]);
    await mountActivity(root, { doc: document, activity });
    const rows = () => root.querySelectorAll('[role="log"] tbody tr').length;
    expect(rows()).toBe(2);
    const site = root.querySelector('#activity-site') as HTMLSelectElement;
    site.value = 'https://b.example';
    site.dispatchEvent(new Event('change'));
    expect(rows()).toBe(1);
    expect(root.querySelector('[role="log"]')?.textContent).toContain('Other');
    site.value = '';
    site.dispatchEvent(new Event('change'));
    const day = root.querySelector('#activity-day') as HTMLSelectElement;
    day.value = '2026-01-15';
    day.dispatchEvent(new Event('change'));
    expect(rows()).toBe(1);
  });

  it('says so when the log is empty', async () => {
    const { root, activity } = setup([]);
    await mountActivity(root, { doc: document, activity });
    expect(root.textContent).toMatch(/No questions are logged yet/);
  });

  it('keeps hostile text as text', async () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const { root, activity } = setup([record({ model: hostile, origin: 'https://x.example' })]);
    await mountActivity(root, { doc: document, activity });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain(hostile);
  });

  it('has "include content" off by default and stores the choice', async () => {
    const { root, activity, log } = setup();
    await mountActivity(root, { doc: document, activity });
    const box = root.querySelector('#activity-content') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await flush();
    expect(log.content).toBe(true);
  });

  it('exports JSON that fits the schema and CSV, of what the filters show', async () => {
    const { root, activity, downloads } = setup([
      record({ id: 'a' }),
      record({ id: 'b', origin: 'https://b.example' }),
    ]);
    await mountActivity(root, { doc: document, activity });
    const site = root.querySelector('#activity-site') as HTMLSelectElement;
    site.value = 'https://b.example';
    site.dispatchEvent(new Event('change'));
    button(root, /Export JSON/).click();
    button(root, /Export CSV/).click();
    const [json, csv] = downloads;
    expect(json?.name).toBe('webaiassist-activity.json');
    const doc = JSON.parse(json?.text ?? '') as { questions: unknown[]; exportedAt: string };
    expect(new Ajv2020({ strict: true }).validate(EXPORT_SCHEMA, doc)).toBe(true);
    expect(doc.questions).toHaveLength(1);
    expect(doc.exportedAt).toBe('2026-01-20T08:00:00.000Z');
    expect(csv?.name).toBe('webaiassist-activity.csv');
    expect(csv?.text.split('\n').length).toBe(2);
  });

  it('clears only after an in-page confirmation, never with confirm()', async () => {
    const { root, activity, log } = setup();
    const native = vi.spyOn(window, 'confirm');
    await mountActivity(root, { doc: document, activity });
    button(root, /^Clear/).click();
    expect(log.records).toHaveLength(1);
    const ask = root.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(ask.textContent).toMatch(/cannot be undone/);
    button(ask, /Keep/).click();
    await flush();
    expect(log.records).toHaveLength(1);
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    button(root, /^Clear/).click();
    button(root.querySelector('[role="alertdialog"]') as HTMLElement, /Remove all/).click();
    await flush();
    expect(log.records).toHaveLength(0);
    expect(root.textContent).toMatch(/No questions are logged yet/);
    expect(native).not.toHaveBeenCalled();
  });
});

describe('re-running a past tool call', () => {
  it('asks first, and runs only after Allow', async () => {
    const { root, activity, calls } = setup();
    await mountActivity(root, { doc: document, activity });
    button(root, /Run again/).click();
    await flush();
    const ask = root.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(ask.textContent).toContain('c09_two_seconds');
    expect(calls).toEqual([]);
    button(ask, /^Allow/).click();
    await flush();
    expect(calls).toEqual([{ name: 'c09_two_seconds', args: { id: 1 } }]);
    expect(root.querySelector('#activity-rerun-result')?.textContent).toContain('waited');
  });

  it('runs nothing after Deny', async () => {
    const { root, activity, calls } = setup();
    await mountActivity(root, { doc: document, activity });
    button(root, /Run again/).click();
    await flush();
    button(root.querySelector('[role="alertdialog"]') as HTMLElement, /^Deny/).click();
    await flush();
    expect(calls).toEqual([]);
    expect(root.querySelector('#activity-rerun-result')?.textContent).toMatch(/not run/i);
  });

  it('offers no button without saved arguments, for a built-in tool, or on another site', async () => {
    const noArgs: ToolCall = { ...call, args: undefined };
    const builtin: ToolCall = { ...call, builtin: true };
    const { root, activity } = setup([
      record({ id: 'a', tools: [noArgs, builtin] }),
      record({ id: 'b', origin: 'https://b.example', tools: [call] }),
    ]);
    await mountActivity(root, { doc: document, activity });
    expect(
      Array.from(root.querySelectorAll('button')).some((b) => /Run again/.test(b.textContent)),
    ).toBe(false);
  });

  it('offers no button when the page was opened without a tab to run in', async () => {
    const { root, activity } = setup();
    await mountActivity(root, { doc: document, activity: { ...activity, target: undefined } });
    expect(
      Array.from(root.querySelectorAll('button')).some((b) => /Run again/.test(b.textContent)),
    ).toBe(false);
  });
});
