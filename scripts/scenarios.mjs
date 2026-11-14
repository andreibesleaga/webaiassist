// SPDX-License-Identifier: Apache-2.0
// The behaviour of WebAIAssist is written as Gherkin in features/*.feature. This script reads
// those files and keeps docs/SCENARIOS.md (scenario, tags, test, status) in step with them.
//   npm run scenarios         writes the table between its markers in docs/SCENARIOS.md
//   npm run check:scenarios   fails on a broken rule or a stale table
// A scenario carries one or more kind tags (@smoke runs in `npm run test:bdd`; @unit is proved
// by the unit test named in a "# test:" comment above it; @gpu, @cpu, @nano and @manual are
// run on hardware or by hand) and, while a later work package still builds the behaviour,
// one @pending-wp1 ... @pending-wp7 tag. A "# req:" comment lists requirement ids it covers.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const KINDS = ['smoke', 'unit', 'gpu', 'cpu', 'nano', 'manual'];
const PENDING = [1, 2, 3, 4, 5, 6, 7].map((n) => `pending-wp${n}`);
const KIND_STATUS = {
  smoke: 'npm run test:bdd',
  unit: 'unit test',
  cpu: 'CPU run',
  gpu: 'maintainer or eval, GPU',
  nano: 'maintainer, Chrome built-in model',
  manual: 'manual check',
};
const START = '<!-- scenarios:start -->';
const END = '<!-- scenarios:end -->';

/** The tag expression of `npm run test:bdd`: @smoke and not waiting for a later package. */
export const BDD_TAG_EXPRESSION = `@smoke and not (${PENDING.map((tag) => `@${tag}`).join(' or ')})`;

const list = (value) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

function featureNumber(file) {
  const match = /(?:^|\/)(\d+)-[^/]*$/.exec(file);
  return match ? match[1] : '00';
}

/** Reads one feature file. Scenario ids are F<file number>.<position>: add new ones last. */
export function parseFeature(text, file) {
  const scenarios = [];
  let featureTags = [];
  let featureName = '';
  let pending = { tags: [], tests: [], reqs: [] };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const comment = /^#\s*(test|req):\s*(.*)$/.exec(line);
    if (comment) pending[comment[1] === 'test' ? 'tests' : 'reqs'].push(...list(comment[2] ?? ''));
    else if (line.startsWith('@')) pending.tags.push(...line.split(/\s+/).map((t) => t.slice(1)));
    else if (line.startsWith('Feature:')) {
      featureName = line.slice('Feature:'.length).trim();
      featureTags = pending.tags;
      pending = { tags: [], tests: [], reqs: [] };
    } else if (/^Scenario( Outline)?:/.test(line)) {
      const id = `F${featureNumber(file)}.${scenarios.length + 1}`;
      const name = line.slice(line.indexOf(':') + 1).trim();
      const tags = [...new Set([...featureTags, ...pending.tags])];
      scenarios.push({ id, feature: featureName, name, file, tags, ...taken(pending) });
      pending = { tags: [], tests: [], reqs: [] };
    } else if (line !== '' && !line.startsWith('#')) {
      pending = { tags: [], tests: [], reqs: [] };
    }
  }
  return scenarios;
}

const taken = ({ tests, reqs }) => ({ tests, reqs });

/** True when `npm run test:bdd` runs the scenario now: @smoke and no @pending-wp tag. */
export const runsInBdd = (scenario) =>
  scenario.tags.includes('smoke') && !scenario.tags.some((tag) => PENDING.includes(tag));

export function statusOf(scenario) {
  const wait = scenario.tags.find((tag) => PENDING.includes(tag));
  if (wait) return `pending ${wait.slice('pending-'.length)}`;
  return KINDS.filter((kind) => scenario.tags.includes(kind))
    .map((kind) => KIND_STATUS[kind])
    .join(', ');
}

function tagProblems(scenario) {
  const problems = [];
  if (!scenario.tags.some((tag) => KINDS.includes(tag))) {
    problems.push(`needs one of ${KINDS.map((kind) => `@${kind}`).join(' ')}`);
  }
  for (const tag of scenario.tags) {
    if (!KINDS.includes(tag) && !PENDING.includes(tag)) problems.push(`unknown tag @${tag}`);
  }
  if (scenario.tags.filter((tag) => PENDING.includes(tag)).length > 1) {
    problems.push('more than one @pending-wp tag');
  }
  return problems;
}

function unitProblems(scenario, exists) {
  const waiting = scenario.tags.some((tag) => PENDING.includes(tag));
  if (!scenario.tags.includes('unit') || waiting) return [];
  if (scenario.tests.length === 0) {
    return ['@unit needs a "# test:" comment naming the unit test'];
  }
  return scenario.tests
    .filter((path) => !exists(path))
    .map((path) => `test file ${path} does not exist`);
}

/** The rules every feature file keeps; one message per problem, led by the scenario id. */
export function checkScenarios(scenarios, exists) {
  const seen = new Set();
  const problems = [];
  for (const scenario of scenarios) {
    const own = [...tagProblems(scenario), ...unitProblems(scenario, exists)];
    if (seen.has(scenario.name)) own.push('the name is used twice');
    seen.add(scenario.name);
    problems.push(...own.map((why) => `${scenario.id} "${scenario.name}": ${why}`));
  }
  return problems;
}

export function countByTag(scenarios) {
  const counts = new Map();
  for (const scenario of scenarios) {
    for (const tag of scenario.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

const cell = (text) => text.replaceAll('|', '\\|');

function testsCell(scenario) {
  const own = scenario.tests.map((path) => `\`${path}\``);
  const bdd = runsInBdd(scenario) ? [`\`${scenario.file}\``] : [];
  const fallback = own.length + bdd.length === 0 ? [`\`${scenario.file}\``] : [];
  return [...bdd, ...own, ...fallback].join(', ');
}

function countsTable(scenarios) {
  const counts = countByTag(scenarios);
  const tags = [...KINDS, ...PENDING].filter((tag) => counts.has(tag));
  const rows = tags.map((tag) => `| @${tag} | ${counts.get(tag)} |`);
  const now = scenarios.filter(runsInBdd).length;
  return [
    '| Tag | Scenarios |',
    '|---|---|',
    ...rows,
    `| all | ${scenarios.length} |`,
    `| run by \`npm run test:bdd\` now | ${now} |`,
  ];
}

function requirementRows(scenarios) {
  const byReq = new Map();
  for (const scenario of scenarios) {
    for (const req of scenario.reqs) byReq.set(req, [...(byReq.get(req) ?? []), scenario.id]);
  }
  return [...byReq.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function renderTable(scenarios) {
  const rows = scenarios.map((s) => {
    const tags = s.tags.map((t) => `@${t}`);
    return `| ${s.id} | ${cell(s.feature)} | ${cell(s.name)} | ${tags.join(' ')} | ${testsCell(s)} | ${statusOf(s)} |`;
  });
  const reqs = requirementRows(scenarios).map(([req, ids]) => `| ${req} | ${ids.join(', ')} |`);
  return [
    '### Count per tag',
    '',
    ...countsTable(scenarios),
    '',
    '### Every scenario',
    '',
    '| Id | Area | Scenario | Tags | Test | Status |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '### Requirement rows',
    '',
    '| Requirement | Scenarios |',
    '|---|---|',
    ...reqs,
  ].join('\n');
}

export function fileExists(path) {
  return existsSync(join(ROOT, path));
}

export function loadScenarios() {
  const dir = join(ROOT, 'features');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.feature'))
    .sort()
    .flatMap((name) => parseFeature(readFileSync(join(dir, name), 'utf8'), `features/${name}`));
}

function replaceBlock(doc, table) {
  const from = doc.indexOf(START);
  const to = doc.indexOf(END);
  if (from < 0 || to < from) throw new Error(`docs/SCENARIOS.md lacks ${START} ... ${END}`);
  return `${doc.slice(0, from + START.length)}\n\n${table}\n\n${doc.slice(to)}`;
}

function main(argv) {
  const scenarios = loadScenarios();
  const problems = checkScenarios(scenarios, fileExists);
  const docPath = join(ROOT, 'docs/SCENARIOS.md');
  const doc = readFileSync(docPath, 'utf8');
  const next = replaceBlock(doc, renderTable(scenarios));
  if (argv.includes('--check')) {
    if (next !== doc) problems.push('docs/SCENARIOS.md is stale: run npm run scenarios');
  } else if (problems.length === 0) {
    writeFileSync(docPath, next);
  }
  if (problems.length > 0) {
    console.error(`features: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`features: OK (${scenarios.length} scenarios)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
