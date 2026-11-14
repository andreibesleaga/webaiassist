// SPDX-License-Identifier: Apache-2.0
// One JSON schema per message type. `JSONSchemaType<T>` makes TypeScript check that each
// schema matches its type in messages.ts. This file has type-only imports so that
// scripts/gen-validators.ts can load it with Node's type stripping.
import type { JSONSchemaType } from 'ajv';
import { siteFile, sitePage } from './site-schemas';
import type {
  GpuProbeRequest,
  GpuProbeResult,
  GpuReport,
  MessageType,
  ModelChatRequest,
  ModelCancel,
  ModelChatResult,
  ModelLoadRequest,
  ModelLoadResult,
  ModelProgress,
  ModelStop,
  ModelToken,
  PageEnvelope,
  ToolsCallRequest,
  ToolsCallResult,
  ToolsChanged,
  ToolsListRequest,
  ToolsListResult,
  WireAnnotations,
  WireChatMessage,
  WireTool,
} from './messages';

const ID = { type: 'string', minLength: 1, maxLength: 64 } as const;
const TAB = { type: 'integer', minimum: 0, nullable: true } as const;
const TEXT = { type: 'string', maxLength: 1000000 } as const;
const NAME = { type: 'string', minLength: 1, maxLength: 128 } as const;
const OBJECT = { type: 'object', required: [], additionalProperties: true } as const;
const TARGET = { type: 'string', enum: ['worker', 'offscreen'] } as const;
const OPTIONAL_FLAG = { type: 'boolean', nullable: true } as const;
const ORIGIN = {
  type: 'string',
  pattern: '^https?://[^/]+$',
  maxLength: 2048,
  nullable: true,
} as const;

const annotations: JSONSchemaType<WireAnnotations> = {
  type: 'object',
  properties: {
    readOnlyHint: OPTIONAL_FLAG,
    consequentialHint: OPTIONAL_FLAG,
    untrustedContentHint: OPTIONAL_FLAG,
  },
  required: [],
};

const tool: JSONSchemaType<WireTool> = {
  type: 'object',
  properties: {
    name: NAME,
    title: { type: 'string', maxLength: 256, nullable: true },
    description: { type: 'string', maxLength: 10000 },
    inputSchema: { ...OBJECT, nullable: true },
    annotations: { ...annotations, nullable: true },
  },
  required: ['name', 'description'],
};

const chatMessage: JSONSchemaType<WireChatMessage> = {
  type: 'object',
  properties: {
    role: { type: 'string', enum: ['system', 'user', 'assistant', 'tool'] },
    content: TEXT,
  },
  required: ['role', 'content'],
  additionalProperties: false,
};

const gpuReport: JSONSchemaType<GpuReport> = {
  type: 'object',
  properties: {
    available: { type: 'boolean' },
    adapter: { type: 'boolean' },
    error: { type: 'string', maxLength: 2000, nullable: true },
    features: { type: 'array', items: { type: 'string', maxLength: 128 }, maxItems: 256 },
    limits: { type: 'object', required: [], additionalProperties: { type: 'number' } },
    vendor: { type: 'string', maxLength: 256, nullable: true },
    architecture: { type: 'string', maxLength: 256, nullable: true },
    fallback: OPTIONAL_FLAG,
  },
  required: ['available', 'adapter', 'features', 'limits'],
  additionalProperties: false,
};

const typed = <T extends string>(value: T) => ({ type: 'string', const: value }) as const;

const toolsListRequest: JSONSchemaType<ToolsListRequest> = {
  type: 'object',
  properties: { type: typed('tools/list'), id: ID, tabId: TAB },
  required: ['type', 'id'],
  additionalProperties: false,
};

const toolsListResult: JSONSchemaType<ToolsListResult> = {
  type: 'object',
  properties: {
    type: typed('tools/list-result'),
    id: ID,
    ok: { type: 'boolean' },
    tools: { type: 'array', items: tool, maxItems: 256 },
    error: { type: 'string', maxLength: 2000, nullable: true },
    origin: ORIGIN,
    linkset: OPTIONAL_FLAG,
    access: { type: 'string', enum: ['denied', 'restricted'], nullable: true },
  },
  required: ['type', 'id', 'ok', 'tools'],
  additionalProperties: false,
};

const toolsCallRequest: JSONSchemaType<ToolsCallRequest> = {
  type: 'object',
  properties: {
    type: typed('tools/call'),
    id: ID,
    tabId: TAB,
    origin: ORIGIN,
    name: NAME,
    args: OBJECT,
  },
  required: ['type', 'id', 'name', 'args'],
  additionalProperties: false,
};

const toolsCallResult: JSONSchemaType<ToolsCallResult> = {
  type: 'object',
  properties: { type: typed('tools/call-result'), id: ID, ok: { type: 'boolean' }, text: TEXT },
  required: ['type', 'id', 'ok', 'text'],
  additionalProperties: false,
};

const toolsChanged: JSONSchemaType<ToolsChanged> = {
  type: 'object',
  properties: { type: typed('tools/changed'), tabId: TAB },
  required: ['type'],
  additionalProperties: false,
};

const modelLoadRequest: JSONSchemaType<ModelLoadRequest> = {
  type: 'object',
  properties: { type: typed('model/load'), id: ID, modelId: NAME },
  required: ['type', 'id', 'modelId'],
  additionalProperties: false,
};

const modelProgress: JSONSchemaType<ModelProgress> = {
  type: 'object',
  properties: {
    type: typed('model/progress'),
    id: ID,
    fraction: { type: 'number', minimum: 0, maximum: 1 },
    text: { type: 'string', maxLength: 2000 },
  },
  required: ['type', 'id', 'fraction', 'text'],
  additionalProperties: false,
};

const modelLoadResult: JSONSchemaType<ModelLoadResult> = {
  type: 'object',
  properties: {
    type: typed('model/load-result'),
    id: ID,
    ok: { type: 'boolean' },
    error: { type: 'string', maxLength: 2000, nullable: true },
    where: { type: 'string', maxLength: 40, nullable: true },
  },
  required: ['type', 'id', 'ok'],
  additionalProperties: false,
};

const modelStop: JSONSchemaType<ModelStop> = {
  type: 'object',
  properties: { type: typed('model/stop'), id: ID },
  required: ['type', 'id'],
  additionalProperties: false,
};

const modelCancel: JSONSchemaType<ModelCancel> = {
  type: 'object',
  properties: { type: typed('model/cancel'), id: ID },
  required: ['type', 'id'],
  additionalProperties: false,
};

const modelChatRequest: JSONSchemaType<ModelChatRequest> = {
  type: 'object',
  properties: {
    type: typed('model/chat'),
    id: ID,
    messages: { type: 'array', items: chatMessage, maxItems: 500 },
    jsonSchema: { ...OBJECT, nullable: true },
  },
  required: ['type', 'id', 'messages'],
  additionalProperties: false,
};

const modelToken: JSONSchemaType<ModelToken> = {
  type: 'object',
  properties: { type: typed('model/token'), id: ID, token: { type: 'string', maxLength: 10000 } },
  required: ['type', 'id', 'token'],
  additionalProperties: false,
};

const modelChatResult: JSONSchemaType<ModelChatResult> = {
  type: 'object',
  properties: { type: typed('model/chat-result'), id: ID, ok: { type: 'boolean' }, text: TEXT },
  required: ['type', 'id', 'ok', 'text'],
  additionalProperties: false,
};

const gpuProbeRequest: JSONSchemaType<GpuProbeRequest> = {
  type: 'object',
  properties: { type: typed('probe/gpu'), id: ID, target: TARGET },
  required: ['type', 'id', 'target'],
  additionalProperties: false,
};

const gpuProbeResult: JSONSchemaType<GpuProbeResult> = {
  type: 'object',
  properties: { type: typed('probe/gpu-result'), id: ID, target: TARGET, report: gpuReport },
  required: ['type', 'id', 'target', 'report'],
  additionalProperties: false,
};

const pageEnvelope: JSONSchemaType<PageEnvelope> = {
  type: 'object',
  properties: {
    source: typed('webaiassist'),
    channel: { type: 'string', pattern: '^[A-Za-z0-9-]{16,64}$' },
    message: OBJECT,
  },
  required: ['source', 'channel', 'message'],
  additionalProperties: false,
};

/** Message type -> schema. The generator names each validator after its key. */
export const MESSAGE_SCHEMAS: Record<MessageType, object> = {
  'tools/list': toolsListRequest,
  'tools/list-result': toolsListResult,
  'tools/call': toolsCallRequest,
  'tools/call-result': toolsCallResult,
  'tools/changed': toolsChanged,
  'model/load': modelLoadRequest,
  'model/progress': modelProgress,
  'model/load-result': modelLoadResult,
  'model/stop': modelStop,
  'model/cancel': modelCancel,
  'model/chat': modelChatRequest,
  'model/token': modelToken,
  'model/chat-result': modelChatResult,
  'probe/gpu': gpuProbeRequest,
  'probe/gpu-result': gpuProbeResult,
  'site/file': siteFile,
  'site/page': sitePage,
};

export const ENVELOPE_SCHEMA: object = pageEnvelope;
