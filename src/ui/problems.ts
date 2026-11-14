// SPDX-License-Identifier: Apache-2.0
// The failures the panel meets while a model loads or answers, sorted into the few the user
// can act on. The runtimes send errors through a port as plain text, so most kinds are told by
// their words; "no graphics acceleration" is raised in the panel itself and has its own class.
import { DEVICE_LOST, MODEL_STOPPED } from '../adapters/model-errors';

export type ProblemKind =
  'no-gpu' | 'device-lost' | 'model-stopped' | 'no-space' | 'endpoint-refused' | 'unexpected';

/** No WebGPU adapter in any host; the message is the sentence for the user. */
export class NoGpuError extends Error {}

/** The endpoint runtime's own words for a 401 or 403 (endpoint-runtime.ts). */
const REFUSED = /The endpoint answered (?:401|403)\b/;

const NO_SPACE = /QuotaExceeded|no space|not enough (?:disk )?space|disk (?:is )?full|ENOSPC/i;

export const problemText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function classifyProblem(error: unknown): ProblemKind {
  if (error instanceof NoGpuError) return 'no-gpu';
  const text = `${error instanceof Error ? error.name : ''} ${problemText(error)}`;
  if (DEVICE_LOST.test(text)) return 'device-lost';
  if (text.includes(MODEL_STOPPED)) return 'model-stopped';
  if (NO_SPACE.test(text)) return 'no-space';
  if (REFUSED.test(text)) return 'endpoint-refused';
  return 'unexpected';
}

/** What "Copy details" copies: the version and the message, cut short; never page content
 *  (the panel's own errors carry none, and a tool's text is not an error of this kind). */
export function errorDetails(version: string, error: unknown): string {
  return `WebAIAssist ${version}\n${problemText(error).slice(0, 500)}`;
}
