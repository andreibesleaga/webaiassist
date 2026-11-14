// SPDX-License-Identifier: Apache-2.0
// What the panel shows while Chrome's built-in model loads: the download percentage, the
// "preparing" step, the plain reason for Chrome's state, and the no-progress line.
import type { LoadProgress } from '../core/ports/model-runtime';
import { readState, REQUIREMENTS, stateReason, type AvailabilityLike } from './prompt-api-state';

export interface DownloadMonitor {
  addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void;
}

/** Follows one load: the last fraction, Chrome's state, and when Chrome last reported. */
export class LoadWatch {
  fraction = 0;
  state = 'asking';
  private last: number;
  constructor(
    private readonly onProgress: (progress: LoadProgress) => void,
    private readonly now: () => number,
    private readonly stallMs: number,
  ) {
    this.last = now();
  }

  readonly monitor = (m: DownloadMonitor): void => {
    m.addEventListener('downloadprogress', (event) => {
      this.fraction = event.loaded;
      this.last = this.now();
      this.show();
    });
  };

  /** Reads Chrome's state and shows it; it never ends the load (only create() does). */
  async poll(lm: AvailabilityLike): Promise<void> {
    this.state = await readState(lm);
    const quiet = this.now() - this.last;
    if (quiet >= this.stallMs) this.stalled(quiet);
    else this.show();
  }

  private show(): void {
    const state = `(Chrome's state: ${this.state})`;
    const text =
      this.fraction >= 1
        ? `Chrome downloaded its model and is preparing it… ${state}`
        : this.fraction > 0
          ? `Chrome is downloading its model: ${Math.round(this.fraction * 100)}% ${state}`
          : `${stateReason(this.state)} ${state}`;
    this.onProgress({ fraction: this.fraction, text });
  }

  private stalled(quietMs: number): void {
    const text =
      `No progress from Chrome for ${Math.round(quietMs / 1000)} s (Chrome's state: ${this.state}). ` +
      'Chrome keeps downloading in the background: wait, or press Cancel and Start later; ' +
      `chrome://on-device-internals shows the download. ${REQUIREMENTS}`;
    this.onProgress({ fraction: this.fraction, text });
  }
}
