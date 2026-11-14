// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  buildReport,
  endpointFromEnv,
  reportText,
  type EndpointRow,
} from '../../scripts/eval/endpoint-plan.ts';

const REMOTE = {
  WEBAIASSIST_ENDPOINT_URL: 'https://openrouter.ai/api/v1',
  WEBAIASSIST_ENDPOINT_MODEL: 'vendor/small',
  WEBAIASSIST_ENDPOINT_KEY: 'sk-or-v1-0123456789',
};

describe('eval:endpoint environment', () => {
  it('reads the address, model and key', () => {
    expect(endpointFromEnv(REMOTE)).toEqual({
      url: 'https://openrouter.ai/api/v1',
      model: 'vendor/small',
      apiKey: 'sk-or-v1-0123456789',
      contextTokens: 8192,
    });
  });

  it('refuses an empty key for a remote address, naming the variable and never a value', () => {
    expect(() => endpointFromEnv({ ...REMOTE, WEBAIASSIST_ENDPOINT_KEY: '' })).toThrow(
      /WEBAIASSIST_ENDPOINT_KEY is empty/,
    );
    expect(() => endpointFromEnv({ ...REMOTE, WEBAIASSIST_ENDPOINT_KEY: undefined })).toThrow(
      /WEBAIASSIST_ENDPOINT_KEY is empty/,
    );
  });

  it('allows no key for an address on this computer, and refuses a missing address or model', () => {
    const local = {
      WEBAIASSIST_ENDPOINT_URL: 'http://localhost:11434/v1',
      WEBAIASSIST_ENDPOINT_MODEL: 'qwen3:0.6b',
    };
    expect(endpointFromEnv(local).apiKey).toBe('');
    expect(() => endpointFromEnv({ ...REMOTE, WEBAIASSIST_ENDPOINT_URL: '' })).toThrow(
      /ADDRESS|URL/,
    );
    expect(() => endpointFromEnv({ ...REMOTE, WEBAIASSIST_ENDPOINT_MODEL: ' ' })).toThrow(/MODEL/);
    expect(() =>
      endpointFromEnv({ ...REMOTE, WEBAIASSIST_ENDPOINT_URL: 'http://10.0.0.1/v1' }),
    ).toThrow(/https/);
  });
});

describe('eval:endpoint report', () => {
  const row = (n: number, cost: number | null, ok = true): EndpointRow => ({
    n,
    text: 'q',
    tools: ['ask'],
    toolRight: ok,
    seconds: n,
    modelCalls: 2,
    promptTokens: 100,
    completionTokens: 10,
    costUsd: cost,
    answer: 'a',
  });

  it('adds up tokens and price, and leaves the price null when the service sent none', () => {
    const config = endpointFromEnv(REMOTE);
    const report = buildReport(config, '2026-11-14', [row(1, 0.001), row(2, 0.002, false)]);
    expect(report.totals).toMatchObject({
      toolRight: 1,
      promptTokens: 200,
      completionTokens: 20,
      medianSeconds: 1.5,
    });
    expect(report.totals.costUsd).toBeCloseTo(0.003);
    expect(buildReport(config, 'd', [row(1, null)]).totals.costUsd).toBeNull();
    expect(report.host).toBe('openrouter.ai');
  });

  it('never contains the key, even when an answer echoes it', () => {
    const config = endpointFromEnv(REMOTE);
    const echo = { ...row(1, 0), answer: `my key is ${config.apiKey}` };
    const text = reportText(buildReport(config, 'd', [echo]), config.apiKey ?? '');
    expect(text).not.toContain('sk-or-v1-0123456789');
    expect(text).toContain('[key]');
  });
});
