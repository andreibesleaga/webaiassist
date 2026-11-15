// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The question before a tool call: the review's reasons, the form messages (the page waits for
// Submit; sensitive fields), and the second question for a tool the page marks as consequential.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ToolInfo } from '../../src/core/types';
import { PanelUI } from '../../src/ui/panel-ui';
import { byId, click, loadPage, tick } from './dom';

const ORIGIN = 'https://node.example';
const base: ToolInfo = { name: 'go', description: 'Does it.', annotations: { readOnlyHint: true } };

describe('the question before a tool call: review and forms', () => {
  let ui: PanelUI;
  beforeEach(() => {
    loadPage('sidepanel.html');
    ui = new PanelUI(document);
  });

  const body = (): string => byId('confirm-body').textContent ?? '';

  it('says "look twice" and gives each reason for a flagged tool', async () => {
    const flagged: ToolInfo = {
      ...base,
      review: [{ id: 'instructions' }, { id: 'look-alike', detail: 'delete' }],
    };
    const answer = ui.confirmToolCall({ tool: flagged, args: {}, origin: ORIGIN });
    expect(body()).toContain('Look twice before you allow');
    expect(body()).toContain('orders to the AI');
    expect(body()).toContain('look-alike');
    click('confirm-deny');
    expect(await answer).toBe(false);
  });

  it('says nothing about a review when there is no finding', async () => {
    const answer = ui.confirmToolCall({ tool: base, args: {}, origin: ORIGIN });
    expect(body()).not.toContain('Look twice');
    click('confirm-deny');
    await answer;
  });

  it('says the page waits for Submit, and writes a line in the transcript after Allow', async () => {
    const form: ToolInfo = { ...base, form: { autosubmit: false, sensitive: [] } };
    const answer = ui.confirmToolCall({ tool: form, args: { q: 'y' }, origin: ORIGIN });
    expect(body()).toContain('The page waits for you to press Submit');
    click('confirm-allow');
    expect(await answer).toBe(true);
    expect(byId('transcript').textContent).toContain('press Submit');
  });

  it('writes no waiting line after Deny, or for a form the browser submits itself', async () => {
    const wait: ToolInfo = { ...base, form: { autosubmit: false, sensitive: [] } };
    const denied = ui.confirmToolCall({ tool: wait, args: {}, origin: ORIGIN });
    click('confirm-deny');
    await denied;
    const auto: ToolInfo = { ...base, form: { autosubmit: true, sensitive: [] } };
    const allowed = ui.confirmToolCall({ tool: auto, args: {}, origin: ORIGIN });
    expect(body()).toContain('submits it by itself');
    click('confirm-allow');
    await allowed;
    expect(byId('transcript').textContent).not.toContain('press Submit');
  });

  it('warns about sensitive fields, in the words of their kinds', async () => {
    const form: ToolInfo = {
      ...base,
      form: { autosubmit: false, sensitive: ['password', 'payment'] },
    };
    const answer = ui.confirmToolCall({ tool: form, args: {}, origin: ORIGIN });
    expect(body()).toContain('password, payment fields');
    click('confirm-deny');
    await answer;
  });

  it('shows reasons as text only', async () => {
    const hostile: ToolInfo = {
      ...base,
      review: [{ id: 'names-other-tool', detail: '<img src=x onerror=alert(1)>' }],
    };
    const answer = ui.confirmToolCall({ tool: hostile, args: {}, origin: ORIGIN });
    expect(byId('confirm-body').querySelector('img')).toBeNull();
    expect(body()).toContain('<img src=x onerror=alert(1)>');
    click('confirm-deny');
    await answer;
  });
});

describe('the second question for a tool the page marks as consequential', () => {
  let ui: PanelUI;
  beforeEach(() => {
    loadPage('sidepanel.html');
    ui = new PanelUI(document);
  });
  const hard: ToolInfo = {
    name: 'wipe',
    description: 'Wipes.',
    annotations: { consequentialHint: true },
  };

  it('asks once more, with another title, and runs only after both Allows', async () => {
    const answer = ui.confirmToolCall({ tool: hard, args: {}, origin: ORIGIN });
    expect(byId('confirm-title').textContent).toBe('Run the tool wipe?');
    click('confirm-allow');
    await tick();
    expect(byId('confirm-title').textContent).toBe('Are you sure about wipe?');
    expect(byId('confirm-body').textContent).toContain('hard to undo');
    expect(byId('confirm-title').textContent?.startsWith('Run the tool')).toBe(false);
    click('confirm-allow');
    expect(await answer).toBe(true);
  });

  it('runs nothing when the second question is denied, or when the first is', async () => {
    const second = ui.confirmToolCall({ tool: hard, args: {}, origin: ORIGIN });
    click('confirm-allow');
    await tick();
    click('confirm-deny');
    expect(await second).toBe(false);
    const first = ui.confirmToolCall({ tool: hard, args: {}, origin: ORIGIN });
    click('confirm-deny');
    expect(await first).toBe(false);
    expect(byId<HTMLDialogElement>('confirm').open).toBe(false);
  });

  it('does not ask again for a tool that changes something but is not marked consequential', async () => {
    const plain: ToolInfo = { name: 'save', description: 'Saves.', annotations: {} };
    const answer = ui.confirmToolCall({ tool: plain, args: {}, origin: ORIGIN });
    click('confirm-allow');
    expect(await answer).toBe(true);
  });

  it('Stop (cancelDialog) during the second question answers Deny', async () => {
    const answer = ui.confirmToolCall({ tool: hard, args: {}, origin: ORIGIN });
    click('confirm-allow');
    await tick();
    ui.cancelDialog();
    expect(await answer).toBe(false);
  });
});
