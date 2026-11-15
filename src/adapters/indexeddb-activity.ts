// SPDX-License-Identifier: Apache-2.0
// ActivityLog adapter on IndexedDB (through `idb`). A database of its own, apart from the chat
// memory, so that a change to one never needs a migration of the other. Shared by the side
// panel (which writes) and the explorer tab (which reads, exports and clears): both are pages of
// this extension, so they see one database.
//
// Why IndexedDB and not chrome.storage.local: the extension already keeps its memory there;
// entries can be removed one by one and by site without rewriting the rest; and
// chrome.storage.local holds about 10 MB for the whole extension (more only with the
// "unlimitedStorage" permission, which this extension does not ask for) and loads whole values.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { ACTIVITY_CAP_BYTES, overflow } from '../core/activity-cap';
import type { ActivityLog, QuestionRecord } from '../core/ports/activity-log';

interface ActivitySchema extends DBSchema {
  questions: { key: string; value: QuestionRecord; indexes: { byTime: string; byOrigin: string } };
  settings: { key: string; value: { key: string; includeContent: boolean } };
}

const VERSION = 1;
const SETTINGS_KEY = 'main';

function upgrade(db: IDBPDatabase<ActivitySchema>): void {
  const store = db.createObjectStore('questions', { keyPath: 'id' });
  store.createIndex('byTime', 'at');
  store.createIndex('byOrigin', 'origin');
  db.createObjectStore('settings', { keyPath: 'key' });
}

class IndexedDbActivity implements ActivityLog {
  constructor(
    private readonly db: IDBPDatabase<ActivitySchema>,
    private readonly cap: number,
  ) {}

  async append(record: QuestionRecord): Promise<void> {
    const tx = this.db.transaction('questions', 'readwrite');
    await tx.store.put(record);
    const all = await tx.store.index('byTime').getAll();
    await Promise.all(overflow(all, this.cap).map((id) => tx.store.delete(id)));
    await tx.done;
  }

  list(): Promise<readonly QuestionRecord[]> {
    return this.db.getAllFromIndex('questions', 'byTime');
  }

  async forgetSite(origin: string): Promise<void> {
    const tx = this.db.transaction('questions', 'readwrite');
    const keys = await tx.store.index('byOrigin').getAllKeys(origin);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  }

  async clear(): Promise<void> {
    await this.db.clear('questions');
  }

  async includeContent(): Promise<boolean> {
    return (await this.db.get('settings', SETTINGS_KEY))?.includeContent === true;
  }

  async setIncludeContent(on: boolean): Promise<void> {
    await this.db.put('settings', { key: SETTINGS_KEY, includeContent: on });
  }
}

export async function openIndexedDbActivity(
  name = 'webaiassist-activity',
  cap: number = ACTIVITY_CAP_BYTES,
): Promise<ActivityLog> {
  const db = await openDB<ActivitySchema>(name, VERSION, { upgrade });
  return new IndexedDbActivity(db, cap);
}
