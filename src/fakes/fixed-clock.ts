// SPDX-License-Identifier: Apache-2.0
import type { Clock } from '../core/ports/clock';

/** A clock stopped at a fixed past time. */
export class FixedClock implements Clock {
  constructor(private readonly iso: string = '2026-01-15T10:00:00.000Z') {}

  nowIso(): string {
    return this.iso;
  }
}
