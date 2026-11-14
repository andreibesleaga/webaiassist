// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { chromeArgs, nanoVerdict, splitWinArgs } from '../../scripts/eval/nano-plan.ts';

describe('chromeArgs', () => {
  const args = chromeArgs('C:\\p');
  it('keeps the profile and lets the extension be loaded over the debugging pipe', () => {
    expect(args).toContain('--user-data-dir=C:\\p');
    expect(args).toContain('--remote-debugging-pipe');
    expect(args).toContain('--enable-unsafe-extension-debugging');
  });
  it('turns on page tools under both feature names (Chrome 157 and Chromium 156)', () => {
    expect(args).toContain('--enable-features=WebMCP,WebMCPTesting');
  });
  it("does not switch off the services Chrome's built-in model needs", () => {
    const line = args.join(' ');
    expect(line).not.toContain('--disable-component-update');
    expect(line).not.toContain('--disable-background-networking');
    expect(line).not.toContain('--disable-');
  });
});

describe('nanoVerdict', () => {
  const row = { toolRight: 1 as const };
  it('passes when the model was ready and every prompt ended without an error', () => {
    expect(nanoVerdict({ ready: true, rows: [row, { toolRight: 0 as const }] })).toEqual({
      ok: true,
      line: 'ready; 2 prompts, right tool in 1, errors 0',
    });
  });
  it('fails when the model never got ready', () => {
    expect(nanoVerdict({ ready: false, rows: [] }).ok).toBe(false);
  });
  it('fails when a prompt ended with an error', () => {
    expect(
      nanoVerdict({ ready: true, rows: [{ ...row, error: 'the model did not answer' }] }).ok,
    ).toBe(false);
  });
});

describe('splitWinArgs', () => {
  it('takes --script out of the arguments passed on to the eval', () => {
    expect(splitWinArgs(['--script', 'eval:nano', '--prompts', '3'])).toEqual({
      script: 'eval:nano',
      folder: 'webaiassist-eval-nano',
      evalArgs: ['--prompts', '3'],
      dryRun: false,
    });
  });
  it('defaults to the graphics-card eval', () => {
    expect(splitWinArgs(['--dry-run', '--idle', '2'])).toEqual({
      script: 'eval:gpu',
      folder: 'webaiassist-eval',
      evalArgs: ['--idle', '2'],
      dryRun: true,
    });
  });
  it('refuses a script that is not an eval', () => {
    expect(() => splitWinArgs(['--script', 'build && del'])).toThrow(/eval:/);
  });
});
