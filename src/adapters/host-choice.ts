// SPDX-License-Identifier: Apache-2.0
// Where the WebLLM model runs, chosen at runtime by a WebGPU probe: the offscreen document
// first, then the extension service worker. The maintainer's measured run (12 Nov 2026,
// Windows 10, Chrome 157, AMD gcn-5) found WebGPU with shader-f16 in both, so the
// offscreen document is the host and the service worker the proven fallback.
import type { GpuReport } from '../protocol/messages';

export type HostTarget = 'offscreen' | 'worker';
export type HostKind = HostTarget | 'none';

export interface HostChoice {
  readonly host: HostKind;
  /** Why each host that was tried before the chosen one did not fit. */
  readonly notes: readonly string[];
}

const ORDER: readonly HostTarget[] = ['offscreen', 'worker'];
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
