// SPDX-License-Identifier: Apache-2.0
import type { ActivityLog, QuestionRecord } from '../core/ports/activity-log';

/** The activity log in memory, for tests. */
export class InMemoryActivity implements ActivityLog {
  records: QuestionRecord[] = [];
  content = false;
  /** Set to make every write fail, as a full disk would. */
  failWrites = false;

  append(record: QuestionRecord): Promise<void> {
    if (this.failWrites) return Promise.reject(new Error('disk full'));
    this.records.push(record);
    return Promise.resolve();
  }
  list(): Promise<readonly QuestionRecord[]> {
    return Promise.resolve([...this.records]);
  }
  forgetSite(origin: string): Promise<void> {
    this.records = this.records.filter((r) => r.origin !== origin);
    return Promise.resolve();
  }
  clear(): Promise<void> {
    this.records = [];
    return Promise.resolve();
  }
  includeContent(): Promise<boolean> {
    return Promise.resolve(this.content);
  }
  setIncludeContent(on: boolean): Promise<void> {
    this.content = on;
    return Promise.resolve();
  }
}
