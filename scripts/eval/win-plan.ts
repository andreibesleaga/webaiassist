// SPDX-License-Identifier: Apache-2.0
// The plan of `npm run eval:gpu:win` (scripts/eval/win.ts): run from WSL, it copies the
// project to a Windows folder and runs the eval there with the Windows Node and Playwright's
// Chromium (installed there; Google Chrome no longer side-loads extensions from the command line),
// so the real GPU and WebMCP are used while everything stays on the
// Windows loopback. The commands are built here so a test can check them without running.
export interface WinPlan {
  readonly rsync: readonly string[];
  readonly cmd: readonly string[];
  readonly copyBack: readonly { from: string; to: string }[];
}

const EXCLUDES = [
  'node_modules',
  'dist',
  'dist-smoke',
  'dist-eval',
  'test-results',
  'docs/eval/EVAL-*.json',
  'docs/eval/screenshots',
  '*.zip',
];

export interface WinPlanInput {
  /** The project in WSL, with a trailing slash. */
  readonly source: string;
  /** The Windows folder seen from WSL (/mnt/c/...), with a trailing slash. */
  readonly target: string;
  /** The same folder as Windows writes it (C:\...). */
  readonly targetWin: string;
  readonly evalArgs: readonly string[];
  /** The npm script run on the Windows side; default `eval:gpu`. */
  readonly script?: string;
}

export function planWin(input: WinPlanInput): WinPlan {
  const rsync = [
    'rsync',
    '-a',
    '--delete',
    ...EXCLUDES.flatMap((name) => ['--exclude', name]),
    input.source,
    input.target,
  ];
  const run = [
    `cd /d ${input.targetWin}`,
    'npm ci --no-audit --no-fund',
    'npx playwright install chromium',
    `npm run ${input.script ?? 'eval:gpu'} -- ${input.evalArgs.join(' ')}`.trimEnd(),
  ].join(' && ');
  const cmd = ['cmd.exe', '/c', run];
  // Only the graphics-card eval fills docs/EVAL.md; the others write a report file.
  const evalMd = { from: `${input.target}docs/EVAL.md`, to: `${input.source}docs/EVAL.md` };
  const copyBack = [
    { from: `${input.target}docs/eval/`, to: `${input.source}docs/eval/` },
    ...((input.script ?? 'eval:gpu') === 'eval:gpu' ? [evalMd] : []),
  ];
  return { rsync, cmd, copyBack };
}
