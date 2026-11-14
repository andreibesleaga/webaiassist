// SPDX-License-Identifier: Apache-2.0

/** Port: the time, injected so that tests use a fixed past clock. */
export interface Clock {
  /** The current time as an ISO 8601 string. */
  nowIso(): string;
}
