// SPDX-License-Identifier: Apache-2.0
// The developer report of "Copy report": tools, schema problems, annotation problems, and the
// security-review hook that returns nothing until another package supplies the rules.
import { describe, expect, it } from 'vitest';
import { reviewFlags } from '../../src/core/review-flags';
import { toolReport, schemaProblems, annotationProblems } from '../../src/core/tool-report';
import type { ToolInfo } from '../../src/core/types';

const good: ToolInfo = {
  name: 'search',
  title: 'Search',
  description: 'Find items.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true },
};

describe('reviewFlags', () => {
  it('returns an empty list for now', () => {
    expect(reviewFlags([good])).toEqual([]);
  });
});

describe('schema and annotation problems', () => {
  it('accepts a complete tool', () => {
    expect(schemaProblems(good)).toEqual([]);
    expect(annotationProblems(good)).toEqual([]);
  });
  it('names a missing description, a missing schema and a schema that is not an object schema', () => {
    expect(schemaProblems({ name: 'a', description: '' })).toEqual([
      'no description',
      'no inputSchema',
    ]);
    expect(schemaProblems({ ...good, inputSchema: { type: 'string' } })).toEqual([
      'inputSchema is not an object schema (type must be "object")',
    ]);
    const odd = { ...good, inputSchema: [] as unknown as ToolInfo['inputSchema'] };
    expect(schemaProblems(odd)).toEqual(['inputSchema is not an object']);
  });
  it('names annotations that are missing, not true or false, or contradict each other', () => {
    expect(annotationProblems({ ...good, annotations: undefined })).toEqual([
      'no readOnlyHint: treated as a tool that changes something',
    ]);
    const bad = { ...good, annotations: { readOnlyHint: 'yes' } } as unknown as ToolInfo;
    expect(annotationProblems(bad)).toEqual(['readOnlyHint is not true or false']);
    const both = { ...good, annotations: { readOnlyHint: true, consequentialHint: true } };
    expect(annotationProblems(both)).toEqual(['readOnlyHint and consequentialHint are both true']);
  });
});

describe('toolReport', () => {
  const report = toolReport([good, { name: 'run', description: '' }]);
  it('lists the tools with their title and read-only mark', () => {
    expect(report).toContain('`search`');
    expect(report).toContain('Search');
    expect(report).toMatch(/`search`.*reads only/);
    expect(report).toMatch(/`run`.*not marked read-only/);
  });
  it('has the problem sections and an empty security section', () => {
    expect(report).toContain('## Schema problems');
    expect(report).toContain('`run`: no description');
    expect(report).toContain('## Annotation problems');
    expect(report).toContain('## Security review flags');
    expect(report).toContain('No flags');
  });
  it('states the draft date and that it is informational', () => {
    expect(report).toContain('13 Nov 2026');
    expect(report).toContain('a W3C Community Group draft');
    expect(report).toContain('informational, not a score or a certification');
    expect(report).not.toMatch(/\b(standard|certified|compatible|conforms)\b/i);
  });
  it('takes the security rows from the port', () => {
    const text = toolReport([good], () => [{ tool: 'search', flag: 'X1', detail: 'why' }]);
    expect(text).toContain('`search`: X1: why');
    expect(text).not.toContain('No flags');
  });
  it('carries only names, titles and descriptions, made visible and on one line', () => {
    const text = toolReport([
      { ...good, name: 'a`b', description: 'line\u0000one\nline two', title: 'T‮' },
    ]);
    expect(text).not.toContain('\u0000');
    expect(text).not.toContain('‮');
    expect(text).not.toMatch(/https?:/);
    expect(text).toContain("`a'b`");
  });
  it('says so when there are no tools', () => {
    expect(toolReport([])).toContain('No tools found');
  });
});
