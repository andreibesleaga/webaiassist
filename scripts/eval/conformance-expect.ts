// SPDX-License-Identifier: Apache-2.0
// The shape of conformance/expect.json, the single source of the conformance cases for the
// browser tests (test/smoke/conformance*.spec.ts), the real-Chrome run (scripts/eval/conformance.ts)
// and the file checks (test/ui/conformance-files.test.ts). No browser here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A name, or a run of numbered names: { prefix: "c15_many_", count: 150, pad: 3 }. */
export type NameSpec =
  string | { readonly prefix: string; readonly count: number; readonly pad: number };

export interface CallExpect {
  /** The tool the scripted model calls. */
  readonly tool: string;
  readonly args: Record<string, unknown>;
  /** The panel asks "Run the tool <name>?" (true) or runs it without a question (false). */
  readonly confirm: boolean;
  /** Texts the transcript must contain once the run ended. */
  readonly shows: readonly string[];
  /** Texts the transcript must not contain. */
  readonly hides?: readonly string[];
  /** A page button pressed a moment after the call was allowed, for example a form's Submit. */
  readonly whileWaiting?: { readonly click: string };
  /** A page button pressed while the tool question is on screen, before it is answered. */
  readonly duringQuestion?: { readonly click: string };
  /** Press Escape (Stop) this many milliseconds into the run. */
  readonly stopAfterMs?: number;
}

export interface PageAction {
  readonly click: string;
  /** What the panel lists after the click. */
  readonly listed: readonly NameSpec[];
}

export interface CaseExpect {
  readonly title: string;
  /** What `document.modelContext.getTools()` returns on the case's page, nothing else. */
  readonly tools: readonly NameSpec[];
  /** What the panel lists once the page has finished registering (default: the same names). */
  readonly listed?: readonly NameSpec[];
  /** Results the page's own check may end with in a browser, and why a status other than pass is fine. */
  readonly selfStatus: readonly ('pass' | 'unsupported')[];
  /** The page's own buttons to press in order, and what the panel lists after each. */
  readonly page?: readonly PageAction[];
  /** What the panel lists after all the calls ran. */
  readonly listedAfterCalls?: readonly NameSpec[];
  readonly calls?: readonly CallExpect[];
  /** Query string added to the page address (case, mode and other are added by the runner). */
  readonly query?: string;
}

export interface ExpectFile {
  readonly version: 1;
  readonly cases: Readonly<Record<string, CaseExpect>>;
}

export function loadExpect(root = process.cwd()): ExpectFile {
  return JSON.parse(readFileSync(join(root, 'conformance/expect.json'), 'utf8')) as ExpectFile;
}

/** Every name of a list, numbered runs spelled out, sorted. */
export function expandNames(specs: readonly NameSpec[]): string[] {
  const names = specs.flatMap((spec) =>
    typeof spec === 'string'
      ? [spec]
      : Array.from(
          { length: spec.count },
          (_, i) => `${spec.prefix}${String(i + 1).padStart(spec.pad, '0')}`,
        ),
  );
  return names.sort();
}

export const listedOf = (c: CaseExpect): string[] => expandNames(c.listed ?? c.tools);
