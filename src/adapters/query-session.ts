// SPDX-License-Identifier: Apache-2.0
// One query worker for one node, shared by the Query tab and the model's tool: it loads the node's graph
// (graph-load.ts) once, answers one query at a time, and is ended by Stop, by a timer, by a cancelled run or
// by close(); the next query starts a fresh worker over the same bytes. Nothing leaves the computer: the
// worker gets bytes and a query, and has no address to ask.
import type { FromWorker, LoadFormat, QueryReply, ToWorker } from '../query/protocol';
import type { GraphLoad } from './graph-load';

/** The part of a Worker that is used. */
export interface WorkerPort {
  postMessage(message: ToWorker, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: { data: FromWorker }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface SessionDeps {
  /** The bytes to load into the store (graph-load.ts); read once, kept for a restart. */
  readonly loadBytes: () => Promise<GraphLoad>;
  readonly makeWorker: () => WorkerPort;
  /** The format of the bytes; N-Quads when left out. */
  readonly format?: LoadFormat;
}

export type RunOutcome =
  | { readonly kind: 'answer'; readonly reply: QueryReply }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'failed'; readonly text: string };

export interface RunOptions {
  readonly maxRows: number;
  readonly ms: number;
  /** Polled while a query runs; a core run signal only has `aborted`. */
  readonly signal?: { readonly aborted: boolean };
}

export type ReadyState =
  { readonly ok: true; readonly size: number } | { readonly ok: false; readonly text: string };

export interface QuerySession {
  /** Loads the graph and starts the worker; the outcome says why not, in a sentence. */
  readonly ready: () => Promise<ReadyState>;
  readonly run: (text: string, options: RunOptions) => Promise<RunOutcome>;
  /** Ends a running query now (and the worker with it). */
  readonly stop: () => void;
  readonly close: () => void;
}

const POLL_MS = 100;
const LOAD_MS = 20_000;

interface Running {
  readonly id: number;
  readonly finish: (outcome: RunOutcome) => void;
}

class Session implements QuerySession {
  private bytes: Uint8Array | undefined;
  private worker: WorkerPort | undefined;
  private loading: Promise<ReadyState> | undefined;
  private running: Running | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private nextId = 1;

  constructor(private readonly deps: SessionDeps) {}

  /** Ends the worker; `outcome` is given to the query that was running, if any. */
  private end(outcome: RunOutcome | undefined): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.loading = undefined;
    if (outcome) this.running?.finish(outcome);
    this.running = undefined;
  }

  private onAnswer(event: { data: FromWorker }): void {
    const message = event.data;
    if (message.type !== 'answer' || this.running?.id !== message.id) return;
    const done = this.running;
    this.running = undefined;
    done.finish({ kind: 'answer', reply: message });
  }

  /** Starts a worker over `graph`; resolves when it says ready, or with the reason it could not. */
  private start(graph: Uint8Array): Promise<ReadyState> {
    return new Promise((resolve) => {
      const port = this.deps.makeWorker();
      this.worker = port;
      const fail = (text: string): void => {
        clearTimeout(timer);
        if (this.worker === port) this.end(undefined);
        resolve({ ok: false, text });
      };
      const timer = setTimeout(() => fail('The query engine did not start in time.'), LOAD_MS);
      port.onerror = () => fail('The query engine could not start.');
      port.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'error') return fail(message.message);
        if (message.type !== 'ready') return;
        clearTimeout(timer);
        port.onerror = () =>
          this.end({ kind: 'failed', text: 'The query engine stopped unexpectedly.' });
        port.onmessage = (answer) => this.onAnswer(answer);
        resolve({ ok: true, size: message.size });
      };
      const copy = graph.slice();
      port.postMessage({ type: 'load', bytes: copy, format: this.deps.format }, [copy.buffer]);
    });
  }

  private async load(): Promise<ReadyState> {
    if (this.bytes === undefined) {
      const graph = await this.deps.loadBytes();
      if (!graph.ok) return { ok: false, text: graph.text };
      this.bytes = graph.bytes;
    }
    return this.start(this.bytes);
  }

  readonly ready = async (): Promise<ReadyState> => {
    if (this.loading) return this.loading;
    const attempt = this.load();
    this.loading = attempt;
    const result = await attempt;
    if (!result.ok && this.loading === attempt) this.loading = undefined;
    return result;
  };

  private post(port: WorkerPort, text: string, options: RunOptions): Promise<RunOutcome> {
    return new Promise<RunOutcome>((resolve) => {
      const id = this.nextId++;
      const timer = setTimeout(() => this.end({ kind: 'timeout' }), options.ms);
      const poll = setInterval(() => {
        if (options.signal?.aborted === true) this.end({ kind: 'stopped' });
      }, POLL_MS);
      this.running = {
        id,
        finish: (outcome) => {
          clearTimeout(timer);
          clearInterval(poll);
          resolve(outcome);
        },
      };
      port.postMessage({ type: 'run', id, text, maxRows: options.maxRows });
    });
  }

  private async runNow(text: string, options: RunOptions): Promise<RunOutcome> {
    const state = await this.ready();
    if (!state.ok) return { kind: 'failed', text: state.text };
    return this.worker ? this.post(this.worker, text, options) : { kind: 'stopped' };
  }

  /** One query at a time: a second call waits for the first. */
  readonly run = (text: string, options: RunOptions): Promise<RunOutcome> => {
    const next = this.queue.then(() => this.runNow(text, options));
    this.queue = next.catch(() => undefined);
    return next;
  };

  readonly stop = (): void => this.end({ kind: 'stopped' });
  readonly close = (): void => this.end({ kind: 'stopped' });
}

export function createQuerySession(deps: SessionDeps): QuerySession {
  return new Session(deps);
}
