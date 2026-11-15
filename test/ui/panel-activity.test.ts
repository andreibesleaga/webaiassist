// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The side panel writes one activity-log entry per question, from what really ran.
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { InMemoryActivity } from '../../src/fakes/in-memory-activity';
import { startPanel } from '../../src/ui/panel-controller';
import { answer, call } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, ORIGIN, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

async function ask(text: string): Promise<void> {
  byId<HTMLTextAreaElement>('question').value = text;
  byId<HTMLFormElement>('ask').requestSubmit();
  await settle();
}

function setup(replies: string[]): { deps: FakeDeps; log: InMemoryActivity } {
  const deps = fakeDeps(replies);
  const log = new InMemoryActivity();
  (deps as { activity?: InMemoryActivity }).activity = log;
  deps.settings = { ...DEFAULT_SETTINGS, confirmMode: 'per-site' };
  deps.grants.origins.add(ORIGIN);
  return { deps, log };
}

async function started(deps: FakeDeps): Promise<void> {
  await startPanel(deps);
  click('start');
  await settle();
}

describe('the panel and the activity log', () => {
  beforeEach(() => loadPage('sidepanel.html'));

  it('writes one entry for an answered question, with names and sizes only', async () => {
    const { deps, log } = setup([answer('Cats are calm.')]);
    await started(deps);
    await ask('Secret question about cats');
    expect(log.records).toHaveLength(1);
    const [entry] = log.records;
    expect(entry).toMatchObject({
      origin: ORIGIN,
      outcome: 'answered',
      steps: 1,
      includeContent: false,
      place: 'gpu',
    });
    expect(entry?.promptTokens).toBeGreaterThan(0);
    expect(entry?.windowTokens).toBeGreaterThan(0);
    expect(JSON.stringify(entry)).not.toContain('Secret question');
    expect(JSON.stringify(entry)).not.toContain('Cats are calm');
  });

  it('records a tool call that was asked and allowed, with its name, decision and sizes', async () => {
    const { deps, log } = setup([call('search', { query: 'a' }), answer('Found.')]);
    deps.settings = { ...DEFAULT_SETTINGS, confirmMode: 'every-call' };
    await started(deps);
    byId<HTMLTextAreaElement>('question').value = 'find a';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    click('confirm-allow');
    await settle();
    const [entry] = log.records;
    expect(entry?.steps).toBe(2);
    expect(entry?.tools).toHaveLength(1);
    expect(entry?.tools[0]).toMatchObject({
      name: 'search',
      asked: true,
      decision: 'allowed',
      ok: true,
      argNames: ['query'],
    });
    expect(entry?.tools[0]?.args).toBeUndefined();
    expect(entry?.tools[0]?.resultBytes).toBeGreaterThan(0);
  });

  it('records a denied call', async () => {
    const { deps, log } = setup([call('search', { query: 'a' }), answer('No.')]);
    deps.settings = { ...DEFAULT_SETTINGS, confirmMode: 'every-call' };
    await started(deps);
    byId<HTMLTextAreaElement>('question').value = 'find a';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    click('confirm-deny');
    await settle();
    expect(log.records[0]?.tools[0]).toMatchObject({ decision: 'denied', asked: true });
  });

  it('keeps the question, arguments and result only when "include content" is on', async () => {
    const { deps, log } = setup([call('search', { query: 'cats' }), answer('Found.')]);
    log.content = true;
    await started(deps);
    await ask('find cats');
    const [entry] = log.records;
    expect(entry?.includeContent).toBe(true);
    expect(entry?.text).toBe('find cats');
    expect(entry?.tools[0]?.args).toEqual({ query: 'cats' });
    expect(typeof entry?.tools[0]?.result).toBe('string');
  });

  it('records how a question ended when it failed, and a write that fails never stops the answer', async () => {
    const { deps, log } = setup(['not json', 'still not json', answer('Fine.')]);
    await started(deps);
    await ask('hello');
    expect(log.records[0]).toMatchObject({ outcome: 'error' });
    expect(log.records[0]?.error).toContain('no valid action');

    log.failWrites = true;
    await ask('again');
    expect(byId('page-note').textContent).toContain('activity');
  });

  it('keeps nothing when the Options turn memory off ("Turn off to keep nothing")', async () => {
    const { deps, log } = setup([answer('Fine.')]);
    deps.settings = { ...deps.settings, memory: false };
    await started(deps);
    await ask('hello');
    expect(log.records).toEqual([]);
  });

  it('does nothing when the host gives no log', async () => {
    const deps = fakeDeps([answer('Fine.')]);
    await started(deps);
    await ask('hello');
    expect(byId('transcript').textContent).toContain('Fine.');
  });
});
