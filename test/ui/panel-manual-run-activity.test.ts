// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// A tool run by hand is written to the activity log as one entry with no model: the tool, the
// question and the answer to it, and the result's size. Content only with "Include content".
import { Ajv2020 } from 'ajv/dist/2020';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityJson } from '../../src/core/activity-export';
import type { ToolInfo } from '../../src/core/types';
import { InMemoryActivity } from '../../src/fakes/in-memory-activity';
import { EXPORT_SCHEMA } from '../../src/core/activity-schema';
import { click, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN, type FakeDeps } from './panel-fakes';
import { fakeClock, flush, open } from './site-helpers';

const lookup: ToolInfo = {
  name: 'lookup',
  description: 'Looks a word up.',
  annotations: { readOnlyHint: true },
  inputSchema: { type: 'object', properties: { word: { type: 'string' } } },
};

async function panel(memory = true): Promise<{ deps: FakeDeps; log: InMemoryActivity }> {
  const deps = fakeDeps([], { bridge: new FakePanelBridge([lookup]) });
  const log = new InMemoryActivity();
  (deps as { activity?: InMemoryActivity }).activity = log;
  deps.settings = { ...deps.settings, memory };
  deps.grants.origins.add(ORIGIN);
  await open(deps);
  return { deps, log };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await flush();
}

async function runByHand(answer: 'confirm-allow' | 'confirm-deny'): Promise<void> {
  const item = document.querySelector('#tools-rows li[data-tool="lookup"]') as HTMLElement;
  (item.querySelector('button.open') as HTMLButtonElement).click();
  (item.querySelector('textarea') as HTMLTextAreaElement).value = '{"word":"cat"}';
  (item.querySelector('.run-part button') as HTMLButtonElement).click();
  await settle();
  click(answer);
  await settle();
}

describe('a tool run by hand and the activity log', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('writes one entry with no model call: the tool, asked and allowed, and no content', async () => {
    const { log } = await panel();
    await runByHand('confirm-allow');
    expect(log.records).toHaveLength(1);
    const [entry] = log.records;
    expect(entry).toMatchObject({
      origin: ORIGIN,
      model: 'Run by hand (no model)',
      place: 'by-hand',
      outcome: 'answered',
      steps: 0,
      calls: [],
      cost: { kind: 'none' },
      includeContent: false,
    });
    expect(entry?.tools).toEqual([
      expect.objectContaining({ name: 'lookup', asked: true, decision: 'allowed', ok: true }),
    ]);
    expect(JSON.stringify(entry)).not.toContain('cat');
  });

  it('the entry passes the published schema of the export', async () => {
    const { log } = await panel();
    await runByHand('confirm-allow');
    const validate = new Ajv2020({ strict: true }).compile(EXPORT_SCHEMA);
    const doc = JSON.parse(activityJson(log.records, '2026-01-20T08:00:00.000Z')) as unknown;
    expect(validate(doc), JSON.stringify(validate.errors)).toBe(true);
  });

  it('a Deny is written as denied, and the page was not called', async () => {
    const { deps, log } = await panel();
    await runByHand('confirm-deny');
    expect(deps.bridge.calls).toHaveLength(0);
    expect(log.records[0]?.tools).toEqual([
      expect.objectContaining({ name: 'lookup', asked: true, decision: 'denied' }),
    ]);
  });

  it('writes nothing when memory is off', async () => {
    const { deps, log } = await panel(false);
    await runByHand('confirm-allow');
    expect(deps.bridge.calls).toHaveLength(1);
    expect(log.records).toHaveLength(0);
  });
});
