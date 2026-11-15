// SPDX-License-Identifier: Apache-2.0
// Logic of the MAIN-world script. It runs inside the page's own JavaScript world, the only
// place that can reach `document.modelContext`, so the page can see, call and imitate it:
// it holds nothing secret, and the isolated script treats everything it says as untrusted.
// It lists the page's tools with getTools(), runs one with executeTool(), and reports
// toolchange events, all as PageEnvelope messages on window.postMessage. It answers only
// messages whose source is its own window, never a frame of the page. Listing and running
// use one rule: entries of the page's own origin and own (top) window whose name no other
// entry uses. A tools/cancel aborts the signal passed to the running call's executeTool.
import type {
  ToolsCallRequest,
  ToolsCancel,
  ToolsListRequest,
  WireAnnotations,
  WireForm,
  WireTool,
} from '../protocol/messages';
import { formsByTool, type DocumentLike } from './form-tools';
import { parseEnvelope, parseMessage } from '../protocol/validate';
import type { ModelContextLike } from './webmcp-reader';

export interface WindowLike {
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown; source?: unknown }) => void,
  ): void;
  readonly location: { readonly origin: string };
  /** The page's own DOM, to read its declarative form tools; left out, no tool is a form. */
  readonly document?: DocumentLike;
}

const STARTED = Symbol.for('webaiassist.main-bridge');
const MAX_TOOLS = 256;
const DESCRIPTION_CAP = 10000;
const TITLE_CAP = 256;
const RESULT_CAP = 1_000_000;
const ERROR_CAP = 2000;
const HINTS = ['readOnlyHint', 'consequentialHint', 'untrustedContentHint', 'debugging'] as const;
/** What a call that ends in a navigation (the browser gives null) is shown as. */
export const NO_RESULT_TEXT =
  'The tool returned no result (the page navigated, or the tool gave nothing back).';

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

function toWire(entry: unknown, forms: ReadonlyMap<string, WireForm>): WireTool | undefined {
  if (!isObject(entry) || !validName(entry)) return undefined;
  const schema = copySchema(entry.inputSchema);
  if (schema === null) return undefined;
  const annotations = hints(entry.annotations);
  const title = titleOf(entry.title);
  const form = forms.get(entry.name);
  return {
    name: entry.name,
    ...(title ? { title } : {}),
    description: entry.description.slice(0, DESCRIPTION_CAP),
    ...(schema ? { inputSchema: schema } : {}),
    ...(annotations ? { annotations } : {}),
    ...(form ? { form } : {}),
  };
}

/** A page without `document.modelContext` simply has no tools: that is not an error. */
async function readEntries(context: ModelContextLike | undefined): Promise<unknown[]> {
  if (!context || typeof context.getTools !== 'function') return [];
  const raw: unknown = await context.getTools();
  if (!Array.isArray(raw)) throw new Error('getTools() did not return a list.');
  return raw as unknown[];
}

/** Where the bridge runs: the page's tool registry, its origin and its own top window. */
interface Page {
  readonly context: ModelContextLike | undefined;
  readonly origin: string;
  readonly win: WindowLike;
}

/**
 * Entries of this page's own origin that the top window registered (an entry with no origin
 * counts as the page's). A tool of a same-origin frame says so through its `window`: it is not
 * the top window, so it is neither listed nor run (tools of frames are not in this release).
 */
function ownEntries(entries: unknown[], page: Page): Record<string, unknown>[] {
  return entries.filter(
    (e): e is Record<string, unknown> =>
      isObject(e) &&
      (typeof e.origin !== 'string' || e.origin === page.origin) &&
      (!('window' in e) || e.window === page.win),
  );
}

/** Names that more than one entry uses: such a tool is neither listed nor run. */
function duplicateNames(entries: Record<string, unknown>[]): Set<unknown> {
  const seen = new Set<unknown>();
  const twice = new Set<unknown>();
  for (const { name } of entries) (seen.has(name) ? twice : seen).add(name);
  return twice;
}

/** The entries the extension lists and runs: own origin, own window, unique name. */
async function usableEntries(page: Page) {
  const own = ownEntries(await readEntries(page.context), page);
  const twice = duplicateNames(own);
  return own.filter((e) => !twice.has(e.name));
}

async function listTools(page: Page, request: ToolsListRequest) {
  const id = request.id;
  try {
    const entries = await usableEntries(page);
    const forms = page.win.document ? formsByTool(page.win.document) : new Map<string, WireForm>();
    const tools = entries
      .map((e) => toWire(e, forms))
      .filter((t): t is WireTool => t !== undefined);
    return {
      type: 'tools/list-result',
      id,
      ok: true,
      tools: tools.slice(0, MAX_TOOLS),
      webmcp: page.context !== undefined,
    };
  } catch (error) {
    const text = errorText(error).slice(0, ERROR_CAP);
    return { type: 'tools/list-result', id, ok: false, tools: [], error: text };
  }
}

/** The text of a result: a string as it is, nothing (null, undefined, or Chrome's text "null")
 *  as one plain sentence. */
function resultText(result: unknown): string {
  if (typeof result === 'string') return result === 'null' ? NO_RESULT_TEXT : result;
  return result === null || result === undefined ? NO_RESULT_TEXT : String(JSON.stringify(result));
}

async function runTool(page: Page, request: ToolsCallRequest, signal: AbortSignal) {
  const entry = (await usableEntries(page)).find((e) => e.name === request.name);
  if (!entry) throw new Error('no such tool on this page');
  if (typeof page.context?.executeTool !== 'function') {
    throw new Error('executeTool() is not available');
  }
  return resultText(await page.context.executeTool(entry, request.args, { signal }));
}

async function callTool(page: Page, request: ToolsCallRequest, signal: AbortSignal) {
  const id = request.id;
  try {
    const text = await runTool(page, request, signal);
    return { type: 'tools/call-result', id, ok: true, text: text.slice(0, RESULT_CAP) };
  } catch (error) {
    const text = `Tool error: ${request.name}: ${errorText(error)}`.slice(0, RESULT_CAP);
    return { type: 'tools/call-result', id, ok: false, text };
  }
}

type Request = ToolsListRequest | ToolsCallRequest | ToolsCancel;

/** A tools/list, tools/call or tools/cancel request in a valid envelope, with its channel. */
function readRequest(data: unknown): { channel: string; request: Request } | undefined {
  const envelope = parseEnvelope(data);
  if (!envelope.ok) return undefined;
  const parsed = parseMessage(envelope.value.message, 'page');
  if (!parsed.ok) return undefined;
  const request = parsed.value;
  if (
    request.type !== 'tools/list' &&
    request.type !== 'tools/call' &&
    request.type !== 'tools/cancel'
  ) {
    return undefined;
  }
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
  /** The calls that are running, by request id, so that a tools/cancel can abort one. */
  const running = new Map<string, AbortController>();
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
  const answer = (found: { channel: string; request: Request }, page: Page): void => {
    const { request, channel } = found;
    if (request.type === 'tools/cancel') return void running.get(request.id)?.abort();
    if (request.type === 'tools/list')
      return void listTools(page, request).then((m) => post(m, channel));
    const controller = new AbortController();
    running.set(request.id, controller);
    void callTool(page, request, controller.signal)
      .then((message) => post(message, channel))
      .finally(() => running.delete(request.id));
  };
  win.addEventListener('message', (event) => {
    // Only the top window itself (the isolated script) may ask; a frame in the page may not.
    if (event.source !== win) return;
    const found = readRequest(event.data);
    if (!found) return;
    lastChannel = found.channel;
    const context = findContext();
    watch(context);
    answer(found, { context, origin: win.location.origin, win });
  });
}
