// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { planWin } from '../../scripts/eval/win-plan.ts';
import { offHosts } from '../../scripts/eval/hosts.ts';

describe('planWin', () => {
  const plan = planWin({
    source: '/home/a/webaiassist/',
    target: '/mnt/c/Users/a/webaiassist-eval/',
    targetWin: 'C:\\Users\\a\\webaiassist-eval',
    evalArgs: ['--models', 'qwen', '--prompts', '3'],
  });
  it('copies the project without the build outputs and old results', () => {
    expect(plan.rsync[0]).toBe('rsync');
    expect(plan.rsync).toContain('node_modules');
    expect(plan.rsync).toContain('.git'); // the repository's own files change while it copies
    expect(plan.rsync).toContain('docs/eval/EVAL-*.json');
    expect(plan.rsync).not.toContain('docs/eval/*.json'); // prompts.json is an input and must be copied
    expect(plan.rsync.at(-2)).toBe('/home/a/webaiassist/');
    expect(plan.rsync.at(-1)).toBe('/mnt/c/Users/a/webaiassist-eval/');
  });
  it("runs the eval on the Windows side with Playwright's Chromium installed there", () => {
    expect(plan.cmd.slice(0, 2)).toEqual(['cmd.exe', '/c']);
    const line = plan.cmd[2] ?? '';
    expect(line).toContain('cd /d C:\\Users\\a\\webaiassist-eval');
    expect(line).toContain('npm ci --no-audit --no-fund && npx playwright install chromium');
    expect(line.endsWith('npm run eval:gpu -- --models qwen --prompts 3')).toBe(true);
  });
  it('runs another eval script when one is named (the built-in model run)', () => {
    const nano = planWin({
      source: '/home/a/webaiassist/',
      target: '/mnt/c/Users/a/webaiassist-eval/',
      targetWin: 'C:\\Users\\a\\webaiassist-eval',
      evalArgs: ['--prompts', '3'],
      script: 'eval:nano',
    });
    expect((nano.cmd[2] ?? '').endsWith('npm run eval:nano -- --prompts 3')).toBe(true);
    expect(nano.copyBack.map((c) => c.to)).toEqual(['/home/a/webaiassist/docs/eval/']);
  });
  it('copies the report and the filled EVAL.md back', () => {
    expect(plan.copyBack.map((c) => c.to)).toEqual([
      '/home/a/webaiassist/docs/eval/',
      '/home/a/webaiassist/docs/EVAL.md',
    ]);
  });
});

describe('offHosts', () => {
  it('accepts the hosts PRIVACY.md names and the extension itself', () => {
    expect(
      offHosts([
        'https://huggingface.co/mlc-ai/x/resolve/main/config.json',
        'https://us.aws.cdn.hf.co/repos/a/b',
        'chrome-extension://abc/model-libs/x.wasm',
        'http://127.0.0.1:4000/tools.json',
        'not a url',
      ]),
    ).toEqual([]);
  });
  it('reports any other host once, sorted', () => {
    expect(
      offHosts(['https://example.com/a', 'https://example.com/b', 'https://cdn.evil.net/x']),
    ).toEqual(['cdn.evil.net', 'example.com']);
  });
});
