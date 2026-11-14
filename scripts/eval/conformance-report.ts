// SPDX-License-Identifier: Apache-2.0
// The pure parts of `npm run eval:conformance` (scripts/eval/conformance.ts): reading the demo
// page list, choosing the one read-only call on a demo page, and the verdict line. No browser here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Checked } from './conformance-run.ts';

export interface DemoPage {
  readonly id: string;
  readonly path: string;
  readonly kind: 'imperative' | 'declarative' | 'both' | 'unknown';
}

export interface DemoFile {
  readonly base: string;
  readonly pages: readonly DemoPage[];
}

export function loadDemoPages(root = process.cwd()): DemoFile {
  return JSON.parse(readFileSync(join(root, 'scripts/eval/demo-pages.json'), 'utf8')) as DemoFile;
}

export const demoUrl = (file: DemoFile, page: DemoPage): string => `${file.base}${page.path}`;

/** A tool as `document.modelContext.getTools()` shows it, reduced to what the choice needs. */
export interface SeenTool {
  readonly name: string;
  readonly readOnly: boolean;
  /** Names of the required arguments. */
  readonly required: readonly string[];
}

/** The tool the scripted model calls on a demo page: the first one that says it only reads and
 *  needs no argument. Form tools carry no read-only hint, so a form is never submitted. */
export function pickReadOnlyCall(tools: readonly SeenTool[]): string | undefined {
  return tools.find((tool) => tool.readOnly && tool.required.length === 0)?.name;
}

export interface DemoRow {
  readonly id: string;
  readonly url: string;
  readonly tools: readonly string[];
  readonly panelLists: readonly string[];
  /** Every page tool is listed by the panel (names a browser lists are sorted, hostile ones may be left out). */
  readonly panelListsAll: boolean;
  readonly call?: { readonly tool: string; readonly asked: boolean; readonly result: string };
  readonly note?: string;
}

export function panelListsAll(tools: readonly string[], panel: readonly string[]): boolean {
  return tools.every((name) => panel.includes(name));
}

export interface StageResult {
  readonly stage: 'browser' | 'extension' | 'demos';
  readonly ok: boolean;
  readonly line: string;
}

/** The line for a stage of checks: how many passed and which did not. */
export function extensionLine(perCase: Readonly<Record<string, readonly Checked[]>>): StageResult {
  const failed = Object.entries(perCase).flatMap(([id, checks]) =>
    checks.filter((check) => !check.ok).map((check) => `${id} ${check.step}`),
  );
  const total = Object.keys(perCase).length;
  return {
    stage: 'extension',
    ok: failed.length === 0,
    line: `extension: ${total} cases, ${failed.length === 0 ? 'all steps as expected' : `not as expected: ${failed.join('; ')}`}`,
  };
}

export function browserLine(results: readonly { id: string; status: string }[]): StageResult {
  const failed = results.filter((r) => r.status === 'fail').map((r) => r.id);
  const unsupported = results.filter((r) => r.status === 'unsupported').map((r) => r.id);
  return {
    stage: 'browser',
    ok: failed.length === 0,
    line: `browser: ${results.length} cases, fail [${failed.join(', ')}], unsupported [${unsupported.join(', ')}]`,
  };
}
