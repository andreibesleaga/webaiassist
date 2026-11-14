// SPDX-License-Identifier: Apache-2.0
// Reads the WebMCP tool registry of a page. The current draft (Community Group report,
// 11 Nov 2026) puts it at `document.modelContext` with registerTool(), getTools() and
// executeTool(registeredTool, input); `navigator.modelContext` is an older name, read only
// as a fallback. Everything the page returns is treated as untrusted data.

export interface ModelContextLike {
  registerTool?(tool: object, options?: object): unknown;
  getTools?(options?: object): unknown;
  executeTool?(tool: unknown, input?: object, options?: object): unknown;
}

export type ContextWhere = 'document' | 'navigator' | 'none';

export interface ToolSummary {
  name: string;
  origin?: string;
  schema: 'object' | 'string' | 'none';
  hints: string[];
}

export type ReadOutcome =
  { ok: true; tools: ToolSummary[]; raw: unknown[] } | { ok: false; error: string };

export type ExecuteOutcome =
  { ok: true; type: string; preview: string } | { ok: false; error: string };

/** Members of the current draft plus older names, so the report shows which shape a browser has. */
const KNOWN_MEMBERS = [
  'registerTool',
  'unregisterTool',
  'getTools',
  'executeTool',
  'provideContext',
  'clearContext',
  'ontoolchange',
  'ontoolactivated',
  'ontoolcancel',
] as const;

const PREVIEW_CAP = 300;

export function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function contextOf(holder: unknown): ModelContextLike | undefined {
  if (typeof holder !== 'object' || holder === null) return undefined;
  const context = (holder as { modelContext?: unknown }).modelContext;
  return typeof context === 'object' && context !== null ? context : undefined;
}

export function findModelContext(
  doc: unknown,
  nav: unknown,
): { where: ContextWhere; context?: ModelContextLike } {
  const fromDocument = contextOf(doc);
  if (fromDocument) return { where: 'document', context: fromDocument };
  const fromNavigator = contextOf(nav);
  if (fromNavigator) return { where: 'navigator', context: fromNavigator };
  return { where: 'none' };
}

export function apiMembers(context: object): string[] {
  return KNOWN_MEMBERS.filter((name) => name in context);
}

function schemaKind(schema: unknown): ToolSummary['schema'] {
  if (typeof schema === 'string') return 'string';
  return typeof schema === 'object' && schema !== null ? 'object' : 'none';
}

function trueHints(annotations: unknown): string[] {
  if (typeof annotations !== 'object' || annotations === null) return [];
  return Object.entries(annotations)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

function summarise(entry: unknown): ToolSummary | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined;
  const tool = entry as Record<string, unknown>;
  if (typeof tool.name !== 'string') return undefined;
  return {
    name: tool.name,
    ...(typeof tool.origin === 'string' ? { origin: tool.origin } : {}),
    schema: schemaKind(tool.inputSchema),
    hints: trueHints(tool.annotations),
  };
}

export async function readTools(context: ModelContextLike): Promise<ReadOutcome> {
  if (typeof context.getTools !== 'function') {
    return { ok: false, error: 'getTools() is not available' };
  }
  try {
    const raw: unknown = await context.getTools();
    if (!Array.isArray(raw)) return { ok: false, error: 'getTools() did not return a list' };
    const tools = raw.map(summarise).filter((t): t is ToolSummary => t !== undefined);
    return { ok: true, tools, raw };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function tryExecute(
  context: ModelContextLike,
  tool: unknown,
  input: object,
): Promise<ExecuteOutcome> {
  if (typeof context.executeTool !== 'function') {
    return { ok: false, error: 'executeTool() is not available' };
  }
  try {
    const result: unknown = await context.executeTool(tool, input);
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return { ok: true, type: typeof result, preview: text.slice(0, PREVIEW_CAP) };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}
