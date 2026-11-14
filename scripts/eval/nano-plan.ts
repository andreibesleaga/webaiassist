// SPDX-License-Identifier: Apache-2.0
// The parts of `npm run eval:nano` (scripts/eval/nano.ts) that need no browser: the command
// line of Google Chrome, the pass/fail line of a run, and the arguments of the Windows runner.
// Chrome's built-in model (Gemini Nano) exists only in Google Chrome, not in Playwright's
// Chromium, and only when Chrome's model service runs: Playwright's default flags switch that
// service off (no component updates, no background networking), so this run passes its own.

/** Chrome's flags for the run: the profile is kept (the model downloads once) and the
 *  extension is loaded over the debugging pipe, the only way Google Chrome still accepts. */
export function chromeArgs(profile: string): string[] {
  return [
    `--user-data-dir=${profile}`,
    '--remote-debugging-pipe',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-unsafe-extension-debugging',
    // Chrome 157 turns page tools on with the feature "WebMCP" (measured 14 Nov 2026:
    // "WebMCPTesting" alone, enough in Chromium 156, leaves document.modelContext absent).
    '--enable-features=WebMCP,WebMCPTesting',
    'about:blank',
  ];
}

export interface VerdictInput {
  readonly ready: boolean;
  readonly rows: readonly { readonly toolRight: 0 | 1; readonly error?: string }[];
}

/** One line for the console and the report: did the model start and did every prompt end. */
export function nanoVerdict(input: VerdictInput): { ok: boolean; line: string } {
  if (!input.ready) return { ok: false, line: 'the model did not get ready' };
  const right = input.rows.filter((row) => row.toolRight === 1).length;
  const errors = input.rows.filter((row) => row.error !== undefined).length;
  const line = `ready; ${input.rows.length} prompts, right tool in ${right}, errors ${errors}`;
  return { ok: errors === 0, line };
}

export interface WinArgs {
  /** The npm script to run on the Windows side. */
  readonly script: string;
  /** The folder under the Windows user's home the project is copied to. */
  readonly folder: string;
  readonly evalArgs: readonly string[];
  readonly dryRun: boolean;
}

const EVAL_SCRIPT = /^eval:[a-z]+$/;

/** `[--script eval:<name>] [--dry-run] <eval args>` of scripts/eval/win.ts. Each script gets
 *  its own Windows folder, so two runs never share one. */
export function splitWinArgs(args: readonly string[]): WinArgs {
  const at = args.indexOf('--script');
  const script = at === -1 ? 'eval:gpu' : (args[at + 1] ?? '');
  if (!EVAL_SCRIPT.test(script)) throw new Error(`--script takes eval:<name>, not "${script}"`);
  const rest = at === -1 ? args : args.filter((_, i) => i !== at && i !== at + 1);
  return {
    script,
    folder: script === 'eval:gpu' ? 'webaiassist-eval' : `webaiassist-${script.replace(':', '-')}`,
    evalArgs: rest.filter((a) => a !== '--dry-run'),
    dryRun: rest.includes('--dry-run'),
  };
}
