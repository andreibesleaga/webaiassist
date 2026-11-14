// SPDX-License-Identifier: Apache-2.0
// Logic of the MAIN-world script. It runs inside the page's own JavaScript world, the only
// place that can reach `document.modelContext`, so the page can see, call and imitate it:
// it holds nothing secret, and the isolated script treats everything it says as untrusted.
// It lists the page's tools with getTools(), runs one with executeTool(), and reports
// toolchange events, all as PageEnvelope messages on window.postMessage. It answers only
// messages whose source is its own window, never a frame of the page. Listing and running
// use one rule: entries of the page's own origin whose name no other entry uses.
import type {
  ToolsCallRequest,
  ToolsListRequest,
  WireAnnotations,
  WireTool,
} from '../protocol/messages';
import { parseEnvelope, parseMessage } from '../protocol/validate';
import type { ModelContextLike } from './webmcp-reader';

export interface WindowLike {
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown; source?: unknown }) => void,
  ): void;
  readonly location: { readonly origin: string };
}

const STARTED = Symbol.for('webaiassist.main-bridge');
const MAX_TOOLS = 256;
const DESCRIPTION_CAP = 10000;
const TITLE_CAP = 256;
const RESULT_CAP = 1_000_000;
const ERROR_CAP = 2000;
const HINTS = ['readOnlyHint', 'consequentialHint', 'untrustedContentHint'] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Boolean hints as given. A consequentialHint that is set but not a boolean ("yes", 1)
 *  counts as true, so an unclear page asks the user; other non-boolean hints are dropped. */
function hints(value: unknown): WireAnnotations | undefined {
  if (!isObject(value)) return undefined;
  const out: WireAnnotations = {};
  for (const key of HINTS) if (typeof value[key] === 'boolean') out[key] = value[key];
  const consequential = value.consequentialHint;
  if (typeof consequential !== 'boolean' && consequential !== undefined && consequential !== null) {
    out.consequentialHint = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A JSON copy of a page schema; undefined when it is not a plain JSON object. */
function copySchema(value: unknown): Record<string, unknown> | undefined | null {
  if (!isObject(value)) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validName(entry: Record<string, unknown>): entry is Record<string, unknown> & {
  name: string;
  description: string;
} {
  const { name, description } = entry;
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 128 &&
    typeof description === 'string'
  );
}

function titleOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value.slice(0, TITLE_CAP) : undefined;
}

function toWire(entry: unknown): WireTool | undefined {
  if (!isObject(entry) || !validName(entry)) return undefined;
  const schema = copySchema(entry.inputSchema);
  if (schema === null) return undefined;
  const annotations = hints(entry.annotations);
  const title = titleOf(entry.title);
  return {
    name: entry.name,
    ...(title ? { title } : {}),
    description: entry.description.slice(0, DESCRIPTION_CAP),
    ...(schema ? { inputSchema: schema } : {}),
    ...(annotations ? { annotations } : {}),
  };
}

/** A page without `document.modelContext` simply has no tools: that is not an error. */
async function readEntries(context: ModelContextLike | undefined): Promise<unknown[]> {
  if (!context || typeof context.getTools !== 'function') return [];
  const raw: unknown = await context.getTools();
  if (!Array.isArray(raw)) throw new Error('getTools() did not return a list.');
  return raw as unknown[];
}

/** Entries of this page's own origin (an entry with no origin counts as the page's). */
function ownEntries(entries: unknown[], origin: string): Record<string, unknown>[] {
  return entries.filter(
    (e): e is Record<string, unknown> =>
      isObject(e) && (typeof e.origin !== 'string' || e.origin === origin),
  );
}

/** Names that more than one entry uses: such a tool is neither listed nor run. */
function duplicateNames(entries: Record<string, unknown>[]): Set<unknown> {
  const seen = new Set<unknown>();
  const twice = new Set<unknown>();
  for (const { name } of entries) (seen.has(name) ? twice : seen).add(name);
  return twice;
}

/** The entries the extension lists and runs: own origin, unique name. */
async function usableEntries(context: ModelContextLike | undefined, origin: string) {
  const own = ownEntries(await readEntries(context), origin);
  const twice = duplicateNames(own);
  return own.filter((e) => !twice.has(e.name));
}

async function listTools(
  context: ModelContextLike | undefined,
  request: ToolsListRequest,
  origin: string,
) {
  const id = request.id;
  try {
    const entries = await usableEntries(context, origin);
    const tools = entries.map(toWire).filter((t): t is WireTool => t !== undefined);
    return {
      type: 'tools/list-result',
      id,
      ok: true,
      tools: tools.slice(0, MAX_TOOLS),
      webmcp: context !== undefined,
    };
  } catch (error) {
    const text = errorText(error).slice(0, ERROR_CAP);
    return { type: 'tools/list-result', id, ok: false, tools: [], error: text };
  }
}

async function runTool(
  context: ModelContextLike | undefined,
  request: ToolsCallRequest,
  origin: string,
) {
  const entries = await usableEntries(context, origin);
  const entry = entries.find((e) => e.name === request.name);
  if (!entry) throw new Error('no such tool on this page');
  if (typeof context?.executeTool !== 'function') throw new Error('executeTool() is not available');
  const result: unknown = await context.executeTool(entry, request.args);
  return typeof result === 'string' ? result : String(JSON.stringify(result));
}

async function callTool(
  context: ModelContextLike | undefined,
  request: ToolsCallRequest,
  origin: string,
) {
  const id = request.id;
  try {
    const text = await runTool(context, request, origin);
    return { type: 'tools/call-result', id, ok: true, text: text.slice(0, RESULT_CAP) };
  } catch (error) {
    const text = `Tool error: ${request.name}: ${errorText(error)}`.slice(0, RESULT_CAP);
    return { type: 'tools/call-result', id, ok: false, text };
  }
}

/** A tools/list or tools/call request in a valid envelope, with its channel. */
function readRequest(
  data: unknown,
): { channel: string; request: ToolsListRequest | ToolsCallRequest } | undefined {
  const envelope = parseEnvelope(data);
  if (!envelope.ok) return undefined;
  const parsed = parseMessage(envelope.value.message, 'page');
  if (!parsed.ok) return undefined;
  const request = parsed.value;
  if (request.type !== 'tools/list' && request.type !== 'tools/call') return undefined;
  return { channel: envelope.value.channel, request };
}

function markStarted(win: WindowLike): boolean {
  const holder = win as unknown as Record<symbol, unknown>;
  if (holder[STARTED] === true) return false;
  Object.defineProperty(holder, STARTED, { value: true });
  return true;
}

export function startMainBridge(
  win: WindowLike,
  findContext: () => ModelContextLike | undefined,
): void {
  if (!markStarted(win)) return;
  let lastChannel: string | undefined;
  const watched = new WeakSet<object>();
  const post = (message: object, channel: string | undefined): void => {
    if (channel) win.postMessage({ source: 'webaiassist', channel, message }, '*');
  };
  const watch = (context: ModelContextLike | undefined): void => {
    const target = context as { addEventListener?: unknown } | undefined;
    if (!context || watched.has(context) || typeof target?.addEventListener !== 'function') return;
    watched.add(context);
    (context as EventTarget).addEventListener('toolchange', () =>
      post({ type: 'tools/changed' }, lastChannel),
    );
  };
  win.addEventListener('message', (event) => {
    // Only the top window itself (the isolated script) may ask; a frame in the page may not.
    if (event.source !== win) return;
    const found = readRequest(event.data);
    if (!found) return;
    lastChannel = found.channel;
    const context = findContext();
    watch(context);
    const { request, channel } = found;
    const reply =
      request.type === 'tools/list'
        ? listTools(context, request, win.location.origin)
        : callTool(context, request, win.location.origin);
    void reply.then((message) => post(message, channel));
  });
}
