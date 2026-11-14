// SPDX-License-Identifier: Apache-2.0
// `npm run eval:endpoint`: what it reads from the environment, and the report it writes. The key
// comes only from the environment and is never part of the report.
import type { EndpointConfig } from '../../src/adapters/endpoint-runtime.ts';
import { endpointUrlProblem, isLocalEndpoint } from '../../src/adapters/endpoint-runtime.ts';

export interface EndpointEnv {
  readonly [name: string]: string | undefined;
}

const NAMES = {
  url: 'WEBAIASSIST_ENDPOINT_URL',
  model: 'WEBAIASSIST_ENDPOINT_MODEL',
  key: 'WEBAIASSIST_ENDPOINT_KEY',
  context: 'WEBAIASSIST_ENDPOINT_CONTEXT',
} as const;

const DEFAULT_CONTEXT = 8192;

/** Why the environment cannot be used, or undefined. */
function envProblem(url: string, model: string, apiKey: string): string | undefined {
  if (url === '')
    return `${NAMES.url} is empty: set the address, such as https://openrouter.ai/api/v1.`;
  const problem = endpointUrlProblem(url);
  if (problem) return `${NAMES.url}: ${problem}`;
  if (model === '') return `${NAMES.model} is empty: set the model name.`;
  if (apiKey === '' && !isLocalEndpoint(url)) {
    return `${NAMES.key} is empty: a remote address needs the API key (it is read from the environment only).`;
  }
  return undefined;
}

/** The endpoint to test. Throws a plain sentence when something is missing: the address and the
 *  model are required, and so is the key, unless the address is on this computer. */
export function endpointFromEnv(env: EndpointEnv): EndpointConfig {
  const url = (env[NAMES.url] ?? '').trim();
  const model = (env[NAMES.model] ?? '').trim();
  const apiKey = env[NAMES.key] ?? '';
  const problem = envProblem(url, model, apiKey);
  if (problem) throw new Error(problem);
  const context = Number(env[NAMES.context] ?? DEFAULT_CONTEXT);
  const contextTokens = Number.isFinite(context) ? context : DEFAULT_CONTEXT;
  return { url, model, apiKey, contextTokens };
}

/** One answered question. */
export interface EndpointRow {
  readonly n: number;
  readonly text: string;
  readonly tools: readonly string[];
  readonly toolRight: boolean;
  readonly seconds: number;
  /** Model calls that reported usage in this question (the counts below are summed over them). */
  readonly modelCalls: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** US dollars, summed over the model calls of the question; null when the service sent none. */
  readonly costUsd: number | null;
  readonly answer: string;
  readonly error?: string;
}

export interface EndpointReport {
  readonly date: string;
  readonly host: string;
  readonly model: string;
  readonly local: boolean;
  readonly rows: readonly EndpointRow[];
  readonly totals: {
    readonly toolRight: number;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly costUsd: number | null;
    readonly medianSeconds: number;
  };
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function buildReport(
  config: EndpointConfig,
  date: string,
  rows: readonly EndpointRow[],
): EndpointReport {
  const costs = rows.flatMap((r) => (r.costUsd === null ? [] : [r.costUsd]));
  return {
    date,
    host: new URL(config.url).host,
    model: config.model,
    local: isLocalEndpoint(config.url),
    rows,
    totals: {
      toolRight: rows.filter((r) => r.toolRight).length,
      promptTokens: sum(rows.map((r) => r.promptTokens)),
      completionTokens: sum(rows.map((r) => r.completionTokens)),
      costUsd: costs.length === 0 ? null : sum(costs),
      medianSeconds: median(rows.map((r) => r.seconds)),
    },
  };
}

/** The report as text for a file or the screen: the key, if it appears anywhere, is removed. */
export function reportText(report: EndpointReport, apiKey: string): string {
  const text = JSON.stringify(report, null, 2);
  return apiKey.length >= 4 ? text.split(apiKey).join('[key]') : text;
}
