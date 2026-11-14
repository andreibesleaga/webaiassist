// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { formatReport, gpuRows, promptRows } from '../../src/spike/report';

describe('formatReport', () => {
  it('writes a titled, dated plain-text report with aligned rows', () => {
    const text = formatReport(
      [
        {
          title: 'WebGPU (page)',
          rows: [
            ['available', 'yes'],
            ['adapter', 'no'],
          ],
        },
        { title: 'Empty', rows: [] },
      ],
      '2026-01-15T10:00:00.000Z',
    );
    expect(text).toBe(
      [
        'WebAIAssist spike report, 2026-01-15T10:00:00.000Z',
        '',
        '## WebGPU (page)',
        'available  yes',
        'adapter    no',
        '',
        '## Empty',
        '(nothing)',
        '',
      ].join('\n'),
    );
  });
});

describe('gpuRows', () => {
  it('lists the facts that decide which model fits', () => {
    const rows = gpuRows({
      available: true,
      adapter: true,
      features: ['shader-f16'],
      limits: { maxBufferSize: 2 },
      vendor: 'v',
      fallback: false,
    });
    expect(rows).toEqual([
      ['navigator.gpu', 'yes'],
      ['adapter', 'yes'],
      ['shader-f16', 'yes'],
      ['vendor', 'v'],
      ['architecture', '-'],
      ['fallback adapter', 'no'],
      ['maxBufferSize', '2'],
    ]);
  });

  it('shows the error when there is one', () => {
    const rows = gpuRows({
      available: false,
      adapter: false,
      features: [],
      limits: {},
      error: 'none',
    });
    expect(rows).toContainEqual(['error', 'none']);
    expect(rows).toContainEqual(['shader-f16', 'no']);
  });
});

describe('promptRows', () => {
  it('lists presence, availability, params and the session', () => {
    expect(
      promptRows({ present: true, availability: 'available', params: '{}', session: 'ok' }),
    ).toEqual([
      ['LanguageModel', 'yes'],
      ['availability()', 'available'],
      ['params()', '{}'],
      ['session', 'ok'],
    ]);
  });

  it('shows dashes for what is unknown and the error', () => {
    expect(promptRows({ present: false })).toEqual([
      ['LanguageModel', 'no'],
      ['availability()', '-'],
      ['params()', '-'],
      ['session', '-'],
    ]);
    expect(promptRows({ present: true, error: 'x' })).toContainEqual(['error', 'x']);
  });
});
