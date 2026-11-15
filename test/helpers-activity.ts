// SPDX-License-Identifier: Apache-2.0
// Entries of the activity log for tests: fixed past dates, no clock.
import type { QuestionRecord } from '../src/core/ports/activity-log';

const CONTEXT = { instructions: 300, tools: 200, site: 0, chat: 100, reply: 20 };

export function record(over: Partial<QuestionRecord> = {}): QuestionRecord {
  return {
    id: 'q1',
    at: '2026-01-15T10:00:00.000Z',
    day: '2026-01-15',
    origin: 'https://node.example',
    model: 'Qwen3 4B',
    place: 'gpu',
    windowTokens: 4096,
    steps: 1,
    firstTokenMs: 200,
    totalMs: 1500,
    outcome: 'answered',
    promptTokens: 600,
    completionTokens: 20,
    tokensEstimated: true,
    cost: { kind: 'none' },
    context: CONTEXT,
    calls: [],
    tools: [],
    includeContent: false,
    bytes: 800,
    ...over,
  };
}
