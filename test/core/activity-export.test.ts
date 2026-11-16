// SPDX-License-Identifier: Apache-2.0
import { Ajv2020 } from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { activityCsv, activityJson, csvCell } from '../../src/core/activity-export';
import { EXPORT_SCHEMA } from '../../src/core/activity-schema';
import { record } from '../helpers-activity';

const NOW = '2026-01-20T08:00:00.000Z';

const full = record({
  id: 'full',
  place: 'remote',
  host: 'openrouter.ai',
  cost: { kind: 'reported', usd: 0.0003 },
  includeContent: true,
  text: 'What is here?',
  calls: [
    {
      promptTokens: 600,
      completionTokens: 20,
      estimated: false,
      costUsd: 0.0003,
      firstTokenMs: 200,
      totalMs: 900,
      context: { instructions: 300, tools: 200, site: 0, chat: 100, reply: 20 },
    },
  ],
  tools: [
    {
      name: 'search',
      builtin: false,
      at: NOW,
      asked: true,
      decision: 'allowed',
      argNames: ['q'],
      argBytes: 9,
      durationMs: 40,
      resultBytes: 12,
      ok: true,
      args: { q: 'cats' },
      result: 'rows',
    },
  ],
});

describe('CSV formula guard', () => {
  it('puts an apostrophe before every dangerous first character, the line feed included', () => {
    for (const start of ['=', '+', '-', '@', '\t', '\r', '\n']) {
      expect(csvCell(`${start}1`).replace(/^"/, '').startsWith(`'${start}`)).toBe(true);
    }
    expect(csvCell('plain')).toBe('plain');
  });
});

describe('JSON export', () => {
  it('matches the published schema, for a full entry, a bare one and an empty log', () => {
    const validate = new Ajv2020({ strict: true }).compile(EXPORT_SCHEMA);
    for (const rows of [[full], [record()], []]) {
      const doc = JSON.parse(activityJson(rows, NOW)) as unknown;
      expect(validate(doc), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('is refused by the schema when a field is missing or unknown', () => {
    const validate = new Ajv2020({ strict: true }).compile(EXPORT_SCHEMA);
    const doc = JSON.parse(activityJson([record()], NOW)) as Record<string, unknown>;
    expect(validate({ ...doc, extra: 1 })).toBe(false);
    expect(validate({ ...doc, questions: [{ id: 'x' }] })).toBe(false);
    expect(validate({ ...doc, version: 2 })).toBe(false);
  });

  it('carries the totals and the time of the export', () => {
    const doc = JSON.parse(activityJson([full, record()], NOW)) as {
      exportedAt: string;
      totals: { questions: number };
    };
    expect(doc.exportedAt).toBe(NOW);
    expect(doc.totals.questions).toBe(2);
  });
});

describe('CSV export', () => {
  it('has a header, one row per entry and quotes cells that need it', () => {
    const lines = activityCsv([record({ error: 'a, "b"\nc' })]).split('\r\n');
    expect(lines[0]).toContain('time,day,site,model');
    expect(lines).toHaveLength(2);
    expect(activityCsv([record({ error: 'a, "b"' })])).toContain('"a, ""b"""');
  });

  it('guards every text cell against a formula in a spreadsheet', () => {
    for (const bad of ['=SUM(A1)', '+1', '-1+2', '@cmd', '\tx', '\rx']) {
      expect(csvCell(bad).replace(/^"/, '')).toMatch(/^'/);
    }
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(undefined)).toBe('');
  });

  it('guards the cells that come from a page or a service', () => {
    const csv = activityCsv([
      record({ origin: 'https://x.example', model: '=cmd()', error: '@SUM(1)', text: '+1' }),
    ]);
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain("'@SUM(1)");
    expect(csv).not.toMatch(/(^|,)=cmd/);
  });

  it('writes none for a local price and nothing for an unknown one', () => {
    const csv = activityCsv([record(), record({ place: 'remote', cost: { kind: 'unknown' } })]);
    expect(csv).toContain(',none,');
    expect(csv).toContain(',unknown,');
  });
});
