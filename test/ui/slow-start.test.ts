// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatUI } from '../../src/core/ports/chat-ui';
import { withSlowStartNotice } from '../../src/ui/slow-start';

function surface(): ChatUI & { drafts: string[] } {
  const drafts: string[] = [];
  return {
    drafts,
    show: () => undefined,
    confirmToolCall: () => Promise.resolve(true),
    showProgress: () => undefined,
    showDraft: (text) => drafts.push(text),
  };
}

describe('slow first answer notice', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says why nothing shows yet when no token has come after the delay', () => {
    const ui = surface();
    withSlowStartNotice(ui, 4000);
    vi.advanceTimersByTime(3999);
    expect(ui.drafts).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(ui.drafts).toEqual([
      'The first answer after a load compiles the model’s GPU programs; this can take up to a minute.',
    ]);
  });

  it('stays quiet when the first token comes in time, and after the question ends', () => {
    const ui = surface();
    const first = withSlowStartNotice(ui, 4000);
    first.ui.showDraft('Hel');
    vi.advanceTimersByTime(10_000);
    expect(ui.drafts).toEqual(['Hel']);
    const second = withSlowStartNotice(ui, 4000);
    second.done();
    vi.advanceTimersByTime(10_000);
    expect(ui.drafts).toEqual(['Hel']);
  });
});
