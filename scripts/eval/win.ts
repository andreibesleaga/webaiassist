// SPDX-License-Identifier: Apache-2.0
// `npm run eval:gpu:win [-- <eval args>] [--dry-run]`: from WSL, run the GPU eval on the
// Windows side (plan in win-plan.ts). `npm run eval:nano:win` runs the built-in model eval the
// same way (`--script eval:nano`). Requires Node on Windows and Google Chrome installed.
import { spawnSync } from 'node:child_process';
import { splitWinArgs } from './nano-plan.ts';
import { planWin } from './win-plan.ts';

const { script, folder, evalArgs, dryRun } = splitWinArgs(process.argv.slice(2));
const user = process.env.WEBAIASSIST_WIN_USER ?? 'Andrei';
const plan = planWin({
  source: `${process.cwd()}/`,
  target: `/mnt/c/Users/${user}/${folder}/`,
  targetWin: `C:\\Users\\${user}\\${folder}`,
  evalArgs,
  script,
});

function run(command: readonly string[]): void {
  console.log(`$ ${command.join(' ')}`);
  if (dryRun) return;
  const [file, ...rest] = command;
  const result = spawnSync(file as string, rest, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`${file} exited with ${result.status ?? 'a signal'}`);
    process.exit(result.status ?? 1);
  }
}

run(plan.rsync);
run(plan.cmd);
for (const { from, to } of plan.copyBack) run(['rsync', '-a', from, to]);
console.log(dryRun ? 'dry run: nothing ran' : 'done: the report is under docs/eval/');
