// SPDX-License-Identifier: Apache-2.0
// The text of the developer's "Copy report": a Markdown note about the WebMCP tools of the open
// page. Only tool names, titles and descriptions appear (cut, made visible, on one line); no
// page text, no address. It is informational: no score, no certificate.
import { reviewFlags, type ReviewFlags } from './review-flags';
import { visible } from './tool-card';
import type { ToolInfo } from './types';

/** The WebMCP draft the checks were written against (read again on this date). */
export const WEBMCP_DRAFT_DATE = '13 Nov 2026';

const NAME_CAP = 64;
const TEXT_CAP = 200;

function line(text: string, cap: number): string {
  const flat = visible(text).replace(/\s+/g, ' ').trim();
  return flat.length <= cap ? flat : `${flat.slice(0, cap - 1)}…`;
}

const nameOf = (tool: ToolInfo): string => `\`${line(tool.name, NAME_CAP).replace(/`/g, "'")}\``;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function schemaProblems(tool: ToolInfo): string[] {
  const problems: string[] = [];
  if (typeof tool.description !== 'string' || tool.description.trim() === '') {
    problems.push('no description');
  }
  const schema: unknown = tool.inputSchema;
  if (schema === undefined || schema === null) problems.push('no inputSchema');
  else if (!isObject(schema)) problems.push('inputSchema is not an object');
  else if (schema.type !== undefined && schema.type !== 'object') {
    problems.push('inputSchema is not an object schema (type must be "object")');
  }
  return problems;
}

export function annotationProblems(tool: ToolInfo): string[] {
  const hints: unknown = tool.annotations;
  if (!isObject(hints)) return ['no readOnlyHint: treated as a tool that changes something'];
  const problems: string[] = [];
  if (hints.readOnlyHint === undefined) {
    problems.push('no readOnlyHint: treated as a tool that changes something');
  }
  for (const key of ['readOnlyHint', 'consequentialHint', 'untrustedContentHint']) {
    if (hints[key] !== undefined && typeof hints[key] !== 'boolean') {
      problems.push(`${key} is not true or false`);
    }
  }
  if (hints.readOnlyHint === true && hints.consequentialHint === true) {
    problems.push('readOnlyHint and consequentialHint are both true');
  }
  return problems;
}

function toolLine(tool: ToolInfo): string {
  const title = tool.title ? ` (${line(tool.title, NAME_CAP)})` : '';
  const mark = tool.annotations?.readOnlyHint === true ? 'reads only' : 'not marked read-only';
  const about = tool.description ? `: ${line(tool.description, TEXT_CAP)}` : '';
  return `- ${nameOf(tool)}${title}, ${mark}${about}`;
}

function section(title: string, rows: readonly string[], none: string): string[] {
  return ['', `## ${title}`, '', ...(rows.length > 0 ? rows : [none])];
}

const problemRows = (tools: readonly ToolInfo[], find: (t: ToolInfo) => string[]): string[] =>
  tools.flatMap((tool) => find(tool).map((problem) => `- ${nameOf(tool)}: ${problem}`));

export function toolReport(tools: readonly ToolInfo[], flags: ReviewFlags = reviewFlags): string {
  const flagRows = flags(tools).map(
    (row) =>
      `- \`${line(row.tool, NAME_CAP).replace(/`/g, "'")}\`: ${line(row.flag, NAME_CAP)}: ${line(row.detail, TEXT_CAP)}`,
  );
  return [
    '# WebMCP tool report',
    '',
    `Checked against WebMCP, a W3C Community Group draft, as read on ${WEBMCP_DRAFT_DATE}.`,
    'This report is informational, not a score or a certification.',
    ...section(`Tools found (${tools.length})`, tools.map(toolLine), 'No tools found.'),
    ...section('Schema problems', problemRows(tools, schemaProblems), 'None found.'),
    ...section('Annotation problems', problemRows(tools, annotationProblems), 'None found.'),
    ...section(
      'Security review flags',
      flagRows,
      'No flags. The review rules are not connected yet.',
    ),
    '',
  ].join('\n');
}
