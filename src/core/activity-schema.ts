// SPDX-License-Identifier: Apache-2.0
// JSON Schema (2020-12) of the activity export. A test validates real exports against it, so the
// file a user keeps has the shape written here. Version 1.
const nonNegative = { type: 'integer', minimum: 0 } as const;
const text = { type: 'string' } as const;
const context = {
  type: 'object',
  additionalProperties: false,
  required: ['instructions', 'tools', 'site', 'chat', 'reply'],
  properties: {
    instructions: nonNegative,
    tools: nonNegative,
    site: nonNegative,
    chat: nonNegative,
    reply: nonNegative,
  },
} as const;

const modelCall = {
  type: 'object',
  additionalProperties: false,
  required: ['promptTokens', 'completionTokens', 'estimated', 'totalMs', 'context'],
  properties: {
    promptTokens: nonNegative,
    completionTokens: nonNegative,
    estimated: { type: 'boolean' },
    costUsd: { type: 'number', minimum: 0 },
    firstTokenMs: { type: 'number', minimum: 0 },
    totalMs: { type: 'number', minimum: 0 },
    context,
  },
} as const;

const toolCall = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'builtin', 'at', 'asked', 'decision', 'argNames', 'argBytes'],
  properties: {
    name: text,
    builtin: { type: 'boolean' },
    at: text,
    asked: { type: 'boolean' },
    decision: { enum: ['not-asked', 'allowed', 'denied'] },
    argNames: { type: 'array', items: text },
    argBytes: nonNegative,
    durationMs: { type: 'number', minimum: 0 },
    resultBytes: nonNegative,
    ok: { type: 'boolean' },
    error: text,
    args: {},
    result: text,
  },
} as const;

const totals = {
  type: 'object',
  additionalProperties: false,
  required: [
    'questions',
    'toolCalls',
    'promptTokens',
    'completionTokens',
    'estimated',
    'costUsd',
    'unpriced',
    'costKind',
    'totalMs',
  ],
  properties: {
    questions: nonNegative,
    toolCalls: nonNegative,
    promptTokens: nonNegative,
    completionTokens: nonNegative,
    estimated: { type: 'boolean' },
    costUsd: { type: 'number', minimum: 0 },
    unpriced: nonNegative,
    costKind: { enum: ['none', 'reported', 'unknown'] },
    totalMs: { type: 'number', minimum: 0 },
  },
} as const;

const question = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'at',
    'day',
    'origin',
    'model',
    'place',
    'windowTokens',
    'steps',
    'totalMs',
    'outcome',
    'promptTokens',
    'completionTokens',
    'tokensEstimated',
    'cost',
    'context',
    'calls',
    'tools',
    'includeContent',
    'bytes',
  ],
  properties: {
    id: text,
    at: text,
    day: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    origin: text,
    model: text,
    place: { enum: ['gpu', 'cpu', 'chrome', 'own-server', 'remote', 'by-hand'] },
    host: text,
    windowTokens: nonNegative,
    steps: nonNegative,
    firstTokenMs: { type: 'number', minimum: 0 },
    totalMs: { type: 'number', minimum: 0 },
    outcome: { enum: ['answered', 'stopped', 'step-limit', 'error'] },
    error: text,
    promptTokens: nonNegative,
    completionTokens: nonNegative,
    tokensEstimated: { type: 'boolean' },
    cost: {
      type: 'object',
      additionalProperties: false,
      required: ['kind'],
      properties: { kind: { enum: ['none', 'reported', 'unknown'] }, usd: { type: 'number' } },
    },
    context,
    calls: { type: 'array', items: modelCall },
    tools: { type: 'array', items: toolCall },
    includeContent: { type: 'boolean' },
    text,
    bytes: nonNegative,
  },
} as const;

export const EXPORT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'WebAIAssist activity export',
  type: 'object',
  additionalProperties: false,
  required: ['format', 'version', 'exportedAt', 'totals', 'questions'],
  properties: {
    format: { const: 'webaiassist-activity' },
    version: { const: 1 },
    exportedAt: text,
    totals,
    questions: { type: 'array', items: question },
  },
} as const;
