// SPDX-License-Identifier: Apache-2.0
// Where WebLLM runs inside the offscreen document. The owner's measured run (12 Nov 2026,
// Windows, Chrome 157, AMD) found WebGPU on the document's main thread and in the service
// worker; a dedicated Worker was never measured, and on that machine WebLLM in the Worker
// said "Unable to find a compatible GPU". So the document asks its Worker for an adapter
// first: yes, the engine runs in the Worker; no, it runs on the document's main thread.

export const PROBE = 'webaiassist/probe-gpu';
export const PROBE_RESULT = 'webaiassist/probe-gpu-result';

export interface WorkerProbe {
  readonly adapter: boolean;
  readonly why?: string;
}

interface GpuLike {
  requestAdapter(): Promise<unknown>;
}

export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

const typed = (data: unknown, type: string): boolean =>
  typeof data === 'object' && data !== null && (data as { type?: unknown }).type === type;

export const isProbe = (data: unknown): boolean => typed(data, PROBE);

/** The Worker's answer: whether navigator.gpu gives it an adapter. */
export async function probeReply(
  gpu: GpuLike | undefined,
): Promise<WorkerProbe & { type: string }> {
  if (!gpu) return { type: PROBE_RESULT, adapter: false, why: 'no navigator.gpu' };
  try {
    const adapter = await gpu.requestAdapter();
    return adapter
      ? { type: PROBE_RESULT, adapter: true }
      : { type: PROBE_RESULT, adapter: false, why: 'no adapter' };
  } catch (error) {
    return {
      type: PROBE_RESULT,
      adapter: false,
      why: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Asks the Worker; no answer within `timeoutMs` counts as no adapter. */
export function askWorker(worker: WorkerLike, timeoutMs: number): Promise<WorkerProbe> {
  return new Promise((resolve) => {
    const done = (probe: WorkerProbe): void => {
      clearTimeout(timer);
      worker.removeEventListener('message', listener);
      resolve(probe);
    };
    const listener = (event: { data: unknown }): void => {
      if (!typed(event.data, PROBE_RESULT)) return;
      const { adapter, why } = event.data as WorkerProbe;
      done(why === undefined ? { adapter } : { adapter, why });
    };
    const timer = setTimeout(
      () => done({ adapter: false, why: `the Worker did not answer in ${timeoutMs} ms` }),
      timeoutMs,
    );
    worker.addEventListener('message', listener);
    worker.postMessage({ type: PROBE });
  });
}

export type Placement = 'offscreen-worker' | 'offscreen-main';

/** Runs the engine in the Worker when it has an adapter, else on the main thread. */
export async function placeEngine<E>(deps: {
  probe(): Promise<WorkerProbe>;
  inWorker(): Promise<E>;
  onMain(): Promise<E>;
}): Promise<{ engine: E; where: Placement }> {
  const probe = await deps.probe();
  if (probe.adapter) return { engine: await deps.inWorker(), where: 'offscreen-worker' };
  return { engine: await deps.onMain(), where: 'offscreen-main' };
}
