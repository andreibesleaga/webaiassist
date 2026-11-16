// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { expandNames, listedOf, loadExpect } from '../../scripts/eval/conformance-expect.ts';
import {
  browserLine,
  demoUrl,
  extensionLine,
  loadDemoPages,
  panelListsAll,
  pickReadOnlyCall,
} from '../../scripts/eval/conformance-report.ts';

describe('expandNames', () => {
  it('spells out numbered runs and sorts', () => {
    expect(expandNames(['b', { prefix: 'n_', count: 3, pad: 2 }, 'a'])).toEqual([
      'a',
      'b',
      'n_01',
      'n_02',
      'n_03',
    ]);
  });
  it('uses the tools as the panel list unless the case says otherwise', () => {
    const cases = loadExpect().cases;
    expect(listedOf(cases.c01 ?? { title: '', tools: [], selfStatus: [] })).toEqual([
      'c01_removable',
      'c01_titled',
      'c01_untitled',
    ]);
    // A same-origin frame's tool is never listed; a hostile definition is listed as not offered.
    expect(listedOf(cases.c14 ?? { title: '', tools: [], selfStatus: [] })).not.toContain(
      'c14_inner_same',
    );
    expect(listedOf(cases.c15 ?? { title: '', tools: [], selfStatus: [] })).toContain(
      'c15_injected',
    );
  });
});

describe('the demo pages', () => {
  const file = loadDemoPages();
  it('are the 18 official pages, all on the one host the demos build permits', () => {
    expect(file.pages).toHaveLength(18);
    for (const page of file.pages) {
      expect(demoUrl(file, page)).toMatch(
        /^https:\/\/googlechromelabs\.github\.io\/webmcp-tools\/demos\/[a-z-]+\/$/,
      );
    }
    expect(new Set(file.pages.map((p) => p.id)).size).toBe(18);
  });
});

describe('pickReadOnlyCall', () => {
  it('takes the first read-only tool that needs no argument', () => {
    expect(
      pickReadOnlyCall([
        { name: 'book', readOnly: false, required: [] },
        { name: 'find', readOnly: true, required: ['q'] },
        { name: 'list', readOnly: true, required: [] },
      ]),
    ).toBe('list');
  });
  it('takes nothing when no tool qualifies, so a form tool is never called', () => {
    expect(pickReadOnlyCall([{ name: 'form', readOnly: false, required: [] }])).toBeUndefined();
    expect(pickReadOnlyCall([])).toBeUndefined();
  });
  it('compares page tools with the panel list', () => {
    expect(panelListsAll(['a', 'b'], ['b', 'a', 'c'])).toBe(true);
    expect(panelListsAll(['a', 'b'], ['a'])).toBe(false);
  });
});

describe('stage lines', () => {
  it('names the cases that are not as expected', () => {
    const line = extensionLine({
      c01: [{ step: 'list', ok: true, detail: '' }],
      c02: [{ step: 'call x', ok: false, detail: 'asked before running' }],
    });
    expect(line.ok).toBe(false);
    expect(line.line).toContain('c02 call x');
  });
  it('fails the browser stage only for fail, not for unsupported', () => {
    expect(browserLine([{ id: 'c11', status: 'unsupported' }]).ok).toBe(true);
    expect(browserLine([{ id: 'c11', status: 'fail' }]).ok).toBe(false);
  });
});
