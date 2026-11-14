// SPDX-License-Identifier: Apache-2.0
// The traceability table (docs/SCENARIOS.md) is generated from features/*.feature. These
// tests pin the reading of tags and comments, the status of a scenario, the rules a feature
// file must keep, and that the committed table is not stale.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BDD_TAG_EXPRESSION,
  checkScenarios,
  countByTag,
  fileExists,
  loadScenarios,
  parseFeature,
  renderTable,
  runsInBdd,
  statusOf,
  type Scenario,
} from '../../scripts/scenarios.mjs';

const SAMPLE = `@smoke
Feature: Sample area

  Background:
    Given a thing

  # test: test/core/gate.test.ts
  # req: LLM06-1, ASI01-1
  @unit @smoke
  Scenario: first one
    Given a step

  @manual
  Scenario Outline: second one
    Given <x>
    Examples:
      | x |
      | 1 |

  @gpu @pending-wp3
  Scenario: third one
    Given a step
`;

const parsed = (): Scenario[] => parseFeature(SAMPLE, 'features/07-sample.feature');
const exists = (): boolean => true;

describe('parseFeature', () => {
  it('reads name, tags (feature tags included), tests and requirement ids per scenario', () => {
    const [first, second, third] = parsed();
    expect(first).toMatchObject({
      id: 'F07.1',
      feature: 'Sample area',
      name: 'first one',
      file: 'features/07-sample.feature',
      tags: ['smoke', 'unit'],
      tests: ['test/core/gate.test.ts'],
      reqs: ['LLM06-1', 'ASI01-1'],
    });
    expect(second).toMatchObject({ id: 'F07.2', name: 'second one', tags: ['smoke', 'manual'] });
    expect(second?.tests).toEqual([]);
    expect(third).toMatchObject({ id: 'F07.3', tags: ['smoke', 'gpu', 'pending-wp3'] });
  });

  it('does not carry the comments or tags of one scenario into the next', () => {
    expect(parsed()[1]?.reqs).toEqual([]);
  });
});

describe('runsInBdd', () => {
  const make = (tags: string[]): Scenario => ({ ...(parsed()[0] as Scenario), tags });
  it('is true for @smoke without a pending tag only', () => {
    expect(runsInBdd(make(['smoke', 'unit']))).toBe(true);
    expect(runsInBdd(make(['smoke', 'pending-wp2']))).toBe(false);
    expect(runsInBdd(make(['unit']))).toBe(false);
    expect(runsInBdd(make(['gpu']))).toBe(false);
  });
});

describe('statusOf', () => {
  const make = (tags: string[]): Scenario => ({ ...(parsed()[0] as Scenario), tags });
  it('names the pending package first', () => {
    expect(statusOf(make(['smoke', 'pending-wp5']))).toBe('pending wp5');
  });
  it('says where each kind of scenario runs', () => {
    expect(statusOf(make(['smoke']))).toBe('npm run test:bdd');
    expect(statusOf(make(['unit']))).toBe('unit test');
    expect(statusOf(make(['smoke', 'unit']))).toBe('npm run test:bdd, unit test');
    expect(statusOf(make(['gpu']))).toBe('maintainer or eval, GPU');
    expect(statusOf(make(['cpu']))).toBe('CPU run');
    expect(statusOf(make(['nano']))).toBe('maintainer, Chrome built-in model');
    expect(statusOf(make(['manual']))).toBe('manual check');
  });
});

describe('checkScenarios', () => {
  const ok = (): Scenario[] =>
    parseFeature(SAMPLE.replace('@smoke\nFeature', 'Feature'), 'features/07-sample.feature');

  it('accepts a well-formed file', () => {
    expect(checkScenarios(ok(), exists)).toEqual([]);
  });

  it('wants one kind tag per scenario', () => {
    const [first] = ok();
    const bad = { ...(first as Scenario), tags: ['pending-wp1'] };
    expect(checkScenarios([bad], exists)).toEqual([
      'F07.1 "first one": needs one of @smoke @unit @gpu @cpu @nano @manual',
    ]);
  });

  it('rejects unknown tags and a second pending tag', () => {
    const [first] = ok();
    const bad = { ...(first as Scenario), tags: ['smoke', 'wip', 'pending-wp1', 'pending-wp2'] };
    const problems = checkScenarios([bad], exists);
    expect(problems).toContain('F07.1 "first one": unknown tag @wip');
    expect(problems).toContain('F07.1 "first one": more than one @pending-wp tag');
  });

  it('wants a named, existing test file for a unit scenario, unless it is pending', () => {
    const [first] = ok();
    const noFile = { ...(first as Scenario), tags: ['unit'], tests: [] };
    expect(checkScenarios([noFile], exists)).toEqual([
      'F07.1 "first one": @unit needs a "# test:" comment naming the unit test',
    ]);
    const missing = { ...(first as Scenario), tags: ['unit'] };
    expect(checkScenarios([missing], () => false)).toEqual([
      'F07.1 "first one": test file test/core/gate.test.ts does not exist',
    ]);
    const pending = { ...noFile, tags: ['unit', 'pending-wp2'] };
    expect(checkScenarios([pending], () => false)).toEqual([]);
  });

  it('rejects two scenarios with the same name', () => {
    const [first] = ok();
    const twin = { ...(first as Scenario), id: 'F07.9' };
    expect(checkScenarios([first as Scenario, twin], exists)).toEqual([
      'F07.9 "first one": the name is used twice',
    ]);
  });
});

describe('countByTag and BDD_TAG_EXPRESSION', () => {
  it('counts every tag, and the scenarios that run now', () => {
    const counts = countByTag(parsed());
    expect(counts.get('smoke')).toBe(3);
    expect(counts.get('unit')).toBe(1);
    expect(counts.get('pending-wp3')).toBe(1);
  });

  it('runs @smoke scenarios that carry no pending tag', () => {
    expect(BDD_TAG_EXPRESSION).toBe(
      '@smoke and not (@pending-wp1 or @pending-wp2 or @pending-wp3 or @pending-wp4 or @pending-wp5 or @pending-wp6 or @pending-wp7)',
    );
  });
});

describe('renderTable', () => {
  it('has one row per scenario with its status, and a requirement index', () => {
    const text = renderTable(parsed());
    expect(text).toContain('| F07.1 | Sample area | first one | @smoke @unit |');
    expect(text).toContain('| F07.3 | Sample area | third one | @smoke @gpu @pending-wp3 |');
    expect(text).toContain('| LLM06-1 | F07.1 |');
    expect(text).toContain('| run by `npm run test:bdd` now | 2 |');
  });
});

describe('the committed files', () => {
  const scenarios = loadScenarios();

  it('keep the rules', () => {
    expect(checkScenarios(scenarios, fileExists)).toEqual([]);
  });

  it('leave no scenario pending: each is run, proved by a unit test or tagged for hand or hardware', () => {
    const pending = scenarios.filter((s) => statusOf(s).startsWith('pending'));
    expect(pending.map((s) => s.id)).toEqual([]);
  });

  it('name only unit tests that vitest runs', () => {
    const named = scenarios.flatMap((s) => s.tests);
    expect(named.filter((path) => !/^test\/.+\.test\.ts$/.test(path))).toEqual([]);
  });

  it('have a docs/SCENARIOS.md that is up to date (run: npm run scenarios)', () => {
    const committed = readFileSync('docs/SCENARIOS.md', 'utf8');
    expect(committed).toContain(renderTable(scenarios));
  });
});
