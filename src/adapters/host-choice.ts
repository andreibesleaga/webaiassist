// SPDX-License-Identifier: Apache-2.0
// Where a graphics-card model runs, checked at runtime by a WebGPU probe: the offscreen
// document. The engine runs in a Worker of its own, which the service worker cannot start, so
// the service worker is probed for the diagnostics only and never hosts a model.
import type { GpuReport } from '../protocol/messages';

export type HostTarget = 'offscreen' | 'worker';
export type HostKind = HostTarget | 'none';

export interface HostChoice {
  readonly host: HostKind;
  /** Why each host that was tried before the chosen one did not fit. */
  readonly notes: readonly string[];
}

const ORDER: readonly HostTarget[] = ['offscreen'];
const NAMES: Readonly<Record<HostTarget, string>> = {
  offscreen: 'offscreen document',
  worker: 'service worker',
};

async function tryProbe(
  probe: (target: HostTarget) => Promise<GpuReport>,
  target: HostTarget,
): Promise<string | undefined> {
  try {
    const report = await probe(target);
    return report.adapter ? undefined : (report.error ?? 'no WebGPU');
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function chooseHost(
  probe: (target: HostTarget) => Promise<GpuReport>,
): Promise<HostChoice> {
  const notes: string[] = [];
  for (const target of ORDER) {
    const problem = await tryProbe(probe, target);
    if (problem === undefined) return { host: target, notes };
    notes.push(`${NAMES[target]}: ${problem}`);
  }
  return { host: 'none', notes };
}
