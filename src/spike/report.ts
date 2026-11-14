// SPDX-License-Identifier: Apache-2.0
// Turns the spike results into a plain-text report that fits one screen and can be pasted.
import type { PromptApiReport } from '../adapters/prompt-api-probe';
import type { GpuReport } from '../protocol/messages';

export type Row = readonly [label: string, value: string];

export interface Section {
  readonly title: string;
  readonly rows: readonly Row[];
}

const yesNo = (value: boolean | undefined): string =>
  value === undefined ? '-' : value ? 'yes' : 'no';

function formatSection(section: Section): string[] {
  if (section.rows.length === 0) return [`## ${section.title}`, '(nothing)', ''];
  const width = Math.max(...section.rows.map(([label]) => label.length));
  const rows = section.rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`);
  return [`## ${section.title}`, ...rows, ''];
}

export function formatReport(sections: readonly Section[], when: string): string {
  const header = [`WebAIAssist spike report, ${when}`, ''];
  return [...header, ...sections.flatMap(formatSection)].join('\n');
}

export function gpuRows(report: GpuReport): Row[] {
  const rows: Row[] = [
    ['navigator.gpu', yesNo(report.available)],
    ['adapter', yesNo(report.adapter)],
    ['shader-f16', yesNo(report.features.includes('shader-f16'))],
    ['vendor', report.vendor ?? '-'],
    ['architecture', report.architecture ?? '-'],
    ['fallback adapter', yesNo(report.fallback)],
    ...Object.entries(report.limits).map(([name, value]): Row => [name, String(value)]),
  ];
  return report.error === undefined ? rows : [...rows, ['error', report.error]];
}

export function promptRows(report: PromptApiReport): Row[] {
  const rows: Row[] = [
    ['LanguageModel', yesNo(report.present)],
    ['availability()', report.availability ?? '-'],
    ['params()', report.params ?? '-'],
    ['session', report.session ?? '-'],
  ];
  return report.error === undefined ? rows : [...rows, ['error', report.error]];
}
