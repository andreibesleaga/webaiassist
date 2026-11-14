// SPDX-License-Identifier: Apache-2.0
// Is this computer's graphics card fast enough to be the default model's home? The panel
// measures the first answer after a load (the time from the question to the first text) and
// keeps it with the name of the graphics adapter; src/ui/default-model.ts reads it.
//
// The limit: 20 seconds. On 13 Nov 2026 the owner's laptop (AMD gcn-5) needed about 40 s for the
// first answer (it compiles the GPU programs, docs/eval and the evaluation log) and 8 to 24 s for
// later ones; a person gives up waiting for a first reaction after about 10 s, and 20 s is twice
// that, so that laptop is "slow" with a wide margin and a card that answers within 20 s is not.
export const SLOW_FIRST_ANSWER_MS = 20_000;

export interface GpuMeasure {
  /** "vendor/architecture" of the adapter the time was measured on. */
  readonly key: string;
  readonly firstAnswerMs: number;
}

export type GpuSpeed = 'fast' | 'slow';

/** The speed of this adapter, or undefined when nothing was measured on it. */
export function gpuSpeed(
  measure: GpuMeasure | undefined,
  key: string | undefined,
): GpuSpeed | undefined {
  if (!measure || key === undefined || measure.key !== key) return undefined;
  return measure.firstAnswerMs > SLOW_FIRST_ANSWER_MS ? 'slow' : 'fast';
}

/** A name for the adapter from the probe report; undefined when the browser names nothing. */
export function gpuKey(report: { vendor?: string; architecture?: string }): string | undefined {
  if (report.vendor === undefined && report.architecture === undefined) return undefined;
  return `${report.vendor ?? ''}/${report.architecture ?? ''}`;
}
