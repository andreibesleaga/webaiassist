// SPDX-License-Identifier: Apache-2.0
// Messages between the five parts of the extension. Each type has a JSON schema in
// schemas.ts; every message is checked against it when it arrives (validate.ts).
//
// Hops (who talks to whom):
//   page:      MAIN-world script <-> isolated content script   (window.postMessage, in PageEnvelope)
//   content:   isolated content script <-> service worker      (chrome.runtime)
//   panel:     side panel or spike page <-> service worker     (chrome.runtime)
//   offscreen: service worker <-> offscreen document           (chrome.runtime)
//   site:      side panel <- script it injects in a tab         (chrome.scripting results)

export interface WireAnnotations {
  readOnlyHint?: boolean;
  consequentialHint?: boolean;
  untrustedContentHint?: boolean;
  debugging?: boolean;
}

/** A declarative form tool: the page's form, found in its own DOM by the MAIN-world script. */
export interface WireForm {
  autosubmit: boolean;
  sensitive: ('password' | 'payment' | 'personal')[];
}

export interface WireTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WireAnnotations;
  form?: WireForm;
}

export interface WireChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/** What a WebGPU probe found in one place (a page, the service worker, the offscreen document). */
export interface GpuReport {
  available: boolean;
  adapter: boolean;
  error?: string;
  features: string[];
  limits: Record<string, number>;
  vendor?: string;
  architecture?: string;
  fallback?: boolean;
}

export interface ToolsListRequest {
  type: 'tools/list';
  id: string;
  tabId?: number;
}
export interface ToolsListResult {
  type: 'tools/list-result';
  id: string;
  ok: boolean;
  tools: WireTool[];
  error?: string;
  /** The page's origin, read by the isolated script (the page cannot change it). */
  origin?: string;
  /** True when the page links to /.well-known/knowledge-linkset (an AgenticSystemCore node). */
  linkset?: boolean;
  /** The page has a WebMCP interface (`document.modelContext` or `navigator.modelContext`),
   *  whether or not it registers a tool. Read by the MAIN-world script. */
  webmcp?: boolean;
  /** Set by the service worker only, when it could not add the page scripts: the site is
   *  not allowed yet ('denied'), or no extension may script the page ('restricted'). */
  access?: 'denied' | 'restricted';
}
export interface ToolsCallRequest {
  type: 'tools/call';
  id: string;
  tabId?: number;
  /** The site the run started on. The isolated script refuses the call on any other site;
   *  it is left out only on the page hop, where the MAIN-world script needs no origin. */
  origin?: string;
  name: string;
  args: Record<string, unknown>;
}
/** Stop: tells the page's running tool call `id` (the id of the tools/call) to abort. The
 *  answer is a tools/call-result with the same id, ok and an empty text. */
export interface ToolsCancel {
  type: 'tools/cancel';
  id: string;
  tabId?: number;
}
export interface ToolsCallResult {
  type: 'tools/call-result';
  id: string;
  ok: boolean;
  text: string;
}
export interface ToolsChanged {
  type: 'tools/changed';
  tabId?: number;
}
export interface ModelLoadRequest {
  type: 'model/load';
  id: string;
  modelId: string;
}
export interface ModelProgress {
  type: 'model/progress';
  id: string;
  fraction: number;
  text: string;
}
export interface ModelLoadResult {
  type: 'model/load-result';
  id: string;
  ok: boolean;
  error?: string;
  /** Where the model runs: offscreen-worker (the graphics card) or cpu:<threads>. */
  where?: string;
}
export interface ModelStop {
  type: 'model/stop';
  id: string;
}
/** Cancels the model/load with this id (the download stops). */
export interface ModelCancel {
  type: 'model/cancel';
  id: string;
}
export interface ModelChatRequest {
  type: 'model/chat';
  id: string;
  messages: WireChatMessage[];
  jsonSchema?: Record<string, unknown>;
}
export interface ModelToken {
  type: 'model/token';
  id: string;
  token: string;
}
export interface ModelChatResult {
  type: 'model/chat-result';
  id: string;
  ok: boolean;
  text: string;
}
export interface GpuProbeRequest {
  type: 'probe/gpu';
  id: string;
  target: 'worker' | 'offscreen';
}
export interface GpuProbeResult {
  type: 'probe/gpu-result';
  id: string;
  target: 'worker' | 'offscreen';
  report: GpuReport;
}

/**
 * The answer to one site-file request, as the page script of the isolated world sends it back
 * (src/adapters/site-files.ts): checked like every message before any of it is used.
 */
export interface SiteFileMessage {
  type: 'site/file';
  /** One of the fixed ids in src/core/site-files.ts. */
  id: string;
  /** The origin the script ran on; the panel drops the answer if it is not the tab's. */
  origin: string;
  status: number;
  contentType: string;
  link: string;
  text: string;
  cut: boolean;
  failed?: 'timeout' | 'network';
  /** Base64 SHA-256 of the whole body, absent for a cut body or where WebCrypto is missing. */
  sha256?: string;
}

/**
 * The answer to one graph-file request (src/adapters/graph-files.ts): the same shape as a site
 * file, with its own list of ids (src/core/graph-files.ts) and a larger text cap (4 MiB).
 */
export interface SiteGraphFileMessage extends Omit<SiteFileMessage, 'type'> {
  type: 'site/graph-file';
}

export interface SitePageLink {
  rel: string;
  href: string;
  type?: string;
}

export interface SiteOpenGraph {
  title?: string;
  description?: string;
  type?: string;
  siteName?: string;
}

/** What the open page says about itself, read from its own DOM (no request). */
export interface SitePageMessage {
  type: 'site/page';
  origin: string;
  title: string;
  language?: string;
  description?: string;
  og: SiteOpenGraph;
  jsonLd: string[];
  links: SitePageLink[];
  tdm?: string;
}

export type Message =
  | SiteFileMessage
  | SiteGraphFileMessage
  | SitePageMessage
  | ToolsListRequest
  | ToolsListResult
  | ToolsCallRequest
  | ToolsCallResult
  | ToolsCancel
  | ToolsChanged
  | ModelLoadRequest
  | ModelProgress
  | ModelLoadResult
  | ModelStop
  | ModelCancel
  | ModelChatRequest
  | ModelToken
  | ModelChatResult
  | GpuProbeRequest
  | GpuProbeResult;

export type MessageType = Message['type'];

/** The wrapper for messages on the page hop; `channel` is a per-session random id. */
export interface PageEnvelope {
  source: 'webaiassist';
  channel: string;
  message: Record<string, unknown>;
}

const TOOL_TYPES = [
  'tools/list',
  'tools/list-result',
  'tools/call',
  'tools/call-result',
  'tools/cancel',
  'tools/changed',
] as const;
const MODEL_TYPES = [
  'model/load',
  'model/progress',
  'model/load-result',
  'model/stop',
  'model/cancel',
  'model/chat',
  'model/token',
  'model/chat-result',
] as const;
const PROBE_TYPES = ['probe/gpu', 'probe/gpu-result'] as const;
const SITE_TYPES = ['site/file', 'site/page', 'site/graph-file'] as const;

/** Which message types each hop may carry. Anything else is dropped. */
export const HOPS = {
  page: TOOL_TYPES,
  content: TOOL_TYPES,
  panel: [...TOOL_TYPES, ...MODEL_TYPES, ...PROBE_TYPES],
  offscreen: [...MODEL_TYPES, ...PROBE_TYPES],
  site: SITE_TYPES,
} as const satisfies Record<string, readonly MessageType[]>;

export type Hop = keyof typeof HOPS;
