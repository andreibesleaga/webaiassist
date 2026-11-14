// SPDX-License-Identifier: Apache-2.0
// The WebMCP part of the spike: find the entry point, list its members, register the ten
// stub node tools, read them back through getTools() and run `search` through executeTool().
import {
  apiMembers,
  findModelContext,
  readTools,
  tryExecute,
  type ModelContextLike,
  type ReadOutcome,
  type ToolSummary,
} from '../adapters/webmcp-reader';
import type { ToolInfo } from '../core/types';
import type { Row, Section } from './report';
import { registerStubTools } from './stub-node';

const FLAG = 'chrome://flags/#enable-webmcp-testing';

function countBy(values: readonly string[]): string {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts].map(([v, n]) => `${v} x${n}`).join(', ');
}

const unique = (values: readonly string[]): string => [...new Set(values)].sort().join(', ') || '-';

function countRow(label: string, read: ReadOutcome): Row {
  if (!read.ok) return [label, `error: ${read.error}`];
  const names = read.tools.map((t) => t.name).sort();
  return [label, names.length === 0 ? '0' : `${names.length}: ${names.join(', ')}`];
}

function shapeRows(tools: readonly ToolSummary[]): Row[] {
  return [
    ['inputSchema kinds', countBy(tools.map((t) => t.schema))],
    ['hints seen', unique(tools.flatMap((t) => t.hints))],
    ['origin', unique(tools.flatMap((t) => (t.origin ? [t.origin] : [])))],
  ];
}

async function executeRow(context: ModelContextLike, read: ReadOutcome): Promise<Row> {
  const label = 'executeTool(search)';
  const index = read.ok ? read.tools.findIndex((t) => t.name === 'search') : -1;
  if (!read.ok || index === -1) return [label, 'not run (search is not listed)'];
  const result = await tryExecute(context, read.raw[index], { query: 'handoff' });
  return [label, result.ok ? `${result.type}: ${result.preview}` : `error: ${result.error}`];
}

async function stubRows(
  context: ModelContextLike,
  tools: readonly ToolInfo[],
  signal: AbortSignal,
): Promise<Row[]> {
  const outcome = await registerStubTools(context, tools, signal);
  const refused = outcome.rejected.map((r): Row => [`refused ${r.name}`, r.error]);
  return [['stub registered', `${outcome.registered.length} of ${tools.length}`], ...refused];
}

export async function webmcpSection(
  doc: unknown,
  nav: unknown,
  tools: readonly ToolInfo[],
): Promise<Section> {
  const found = findModelContext(doc, nav);
  const title = 'WebMCP';
  if (!found.context) return { title, rows: [['entry point', `none (turn on ${FLAG})`]] };
  const context = found.context;
  // Aborting the registration signal unregisters the stub tools, so the check can run again.
  const registration = new AbortController();
  const before = await readTools(context);
  const rows: Row[] = [
    ['entry point', `${found.where}.modelContext`],
    ['members', apiMembers(context).join(', ') || '-'],
    countRow('tools before the stub', before),
    ...(await stubRows(context, tools, registration.signal)),
  ];
  const after = await readTools(context);
  rows.push(countRow('tools after the stub', after));
  if (after.ok) rows.push(...shapeRows(after.tools));
  rows.push(await executeRow(context, after));
  registration.abort();
  return { title, rows };
}
