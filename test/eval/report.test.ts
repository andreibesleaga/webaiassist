// SPDX-License-Identifier: Apache-2.0
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fillEvalMd,
  renderResults,
  reportName,
  writeReport,
  type EvalReport,
} from '../../scripts/eval/report.ts';

const REPORT: EvalReport = {
  date: '2026-11-13',
  chrome: '157.0.8103.52',
  os: 'win32 10.0.26300',
  scripted: false,
  webgpu: { panelAdapter: true },
  models: [
    {
      key: 'qwen',
      id: 'Qwen3-0.6B-q4f16_1-MLC',
      ready: true,
      loadS: 42,
      status:
        'Ready: Qwen3, running on the offscreen document’s main thread (WebGPU did not work in its Worker).',
    },
  ],
  targets: [{ name: 'stub', url: 'http://127.0.0.1:1/node/', tools: ['ask'] }],
  rows: [],
  summary: [
    {
      model: 'qwen',
      target: 'stub',
      prompts: 20,
      toolRight: 15,
      gateShown: '17 of 17',
      factInAnswer: '12 of 18',
      hallucinated: 1,
      errors: 2,
      repeated: 4,
      medianFirstTokenS: 3.4,
    },
  ],
  checks: [{ name: 'storage access level', result: 'pass', detail: 'setAccessLevel: ok' }],
  manual: ['Other browsers: …'],
};

const MD = 'intro\n<!-- eval-results:start -->\nold\n<!-- eval-results:end -->\nafter\n';

describe('eval report', () => {
  it('names the file by date and Chrome version', () => {
    expect(reportName(REPORT)).toBe('EVAL-2026-11-13-157.0.8103.52.json');
    expect(reportName({ ...REPORT, scripted: true })).toBe(
      'EVAL-2026-11-13-157.0.8103.52-scripted.json',
    );
  });

  it('writes the JSON report and returns its path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-'));
    const path = writeReport(dir, REPORT);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(REPORT);
  });

  it('renders the summary, the model lines and the checks as Markdown tables', () => {
    const md = renderResults(REPORT, 'docs/eval/EVAL-x.json');
    expect(md).toContain(
      'Last run: 2026-11-13, Chrome 157.0.8103.52, win32 10.0.26300; WebGPU adapter: yes; report `docs/eval/EVAL-x.json`.',
    );
    expect(md).toContain('| qwen | stub | 20 | 15 | 17 of 17 | 12 of 18 | 1 | 2 | 4 | 3.4 |');
    expect(md).toContain('| storage access level | pass | setAccessLevel: ok |');
    expect(md).toContain('main thread');
  });

  it('replaces only the generated block of EVAL.md', () => {
    expect(fillEvalMd(MD, 'new')).toBe(
      'intro\n<!-- eval-results:start -->\nnew\n<!-- eval-results:end -->\nafter\n',
    );
    expect(() => fillEvalMd('no markers', 'x')).toThrow(/eval-results markers/);
  });

  it('keeps a pipe in a cell from breaking the table', () => {
    const md = renderResults(
      { ...REPORT, checks: [{ name: 'a|b', result: 'fail', detail: 'x\ny' }] },
      'r.json',
    );
    expect(md).toContain('| a\\|b | fail | x y |');
  });
});
