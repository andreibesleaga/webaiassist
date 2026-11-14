// SPDX-License-Identifier: Apache-2.0
// The Options section "Downloaded models": one row per model stored in this browser with its
// size and a Remove button, "Remove all" with a question first, and "Forget all sites".
import type { StoredModel, StoreLike } from '../adapters/model-store';
import { byId, element } from './dom';
import { t } from './i18n';

export interface StorageDeps {
  readonly doc: Document;
  readonly store: StoreLike;
  forgetAll(): Promise<void>;
}

const MB = 1_000_000;
const megabytes = (bytes: number): number => Math.round(bytes / MB);
const sizeText = (bytes: number): string =>
  bytes > 0 ? t('storeSize', { size: megabytes(bytes) }) : t('storeSizeUnknown');

function status(deps: StorageDeps, text: string): void {
  byId(deps.doc, 'options-status').textContent = text;
}

function row(deps: StorageDeps, model: StoredModel): HTMLLIElement {
  const doc = deps.doc;
  const item = element(doc, 'li');
  const remove = element(doc, 'button', t('removeOne'));
  remove.type = 'button';
  remove.setAttribute(
    'aria-label',
    t('removeOneLabel', { name: model.name, size: sizeText(model.bytes) }),
  );
  remove.addEventListener('click', () => void removeOne(deps, model));
  item.append(
    element(doc, 'span', t('storeRow', { name: model.name, size: sizeText(model.bytes) })),
    remove,
  );
  return item;
}

/** Lists what is stored; the "remove all" button and the empty line follow the list. */
export async function showStore(deps: StorageDeps): Promise<void> {
  const doc = deps.doc;
  const models = await deps.store.list();
  byId(doc, 'model-store').replaceChildren(...models.map((m) => row(deps, m)));
  byId(doc, 'model-store-empty').hidden = models.length > 0;
  byId(doc, 'remove-all-models').hidden = models.length === 0;
  byId(doc, 'remove-confirm').hidden = true;
}

async function removeOne(deps: StorageDeps, model: StoredModel): Promise<void> {
  try {
    await deps.store.remove(model.runtime, model.id);
    status(deps, t('removedOne', { name: model.name, size: megabytes(model.bytes) }));
  } catch (error) {
    status(
      deps,
      t('removeFailed', { why: error instanceof Error ? error.message : String(error) }),
    );
  }
  await showStore(deps);
}

async function askRemoveAll(deps: StorageDeps): Promise<void> {
  const models = await deps.store.list();
  const bytes = models.reduce((sum, m) => sum + m.bytes, 0);
  const values = { count: models.length, size: megabytes(bytes) };
  byId(deps.doc, 'remove-confirm-text').textContent = t(
    models.length === 1 ? 'removeConfirmOne' : 'removeConfirm',
    values,
  );
  byId(deps.doc, 'remove-confirm').hidden = false;
  byId(deps.doc, 'remove-confirm-ok').focus();
}

async function removeAll(deps: StorageDeps): Promise<void> {
  try {
    const done = await deps.store.removeAll();
    const key = done.count === 1 ? 'removedAllOne' : 'removedAll';
    status(deps, t(key, { count: done.count, size: megabytes(done.bytes) }));
  } catch (error) {
    status(
      deps,
      t('removeFailed', { why: error instanceof Error ? error.message : String(error) }),
    );
  }
  await showStore(deps);
  byId(deps.doc, 'remove-all-models').focus();
}

export async function bindStorage(deps: StorageDeps): Promise<void> {
  const doc = deps.doc;
  byId(doc, 'remove-all-models').addEventListener('click', () => void askRemoveAll(deps));
  byId(doc, 'remove-confirm-ok').addEventListener('click', () => void removeAll(deps));
  byId(doc, 'remove-confirm-no').addEventListener('click', () => {
    byId(doc, 'remove-confirm').hidden = true;
    byId(doc, 'remove-all-models').focus();
  });
  byId(doc, 'forget-all').addEventListener('click', () => {
    void deps.forgetAll().then(() => status(deps, t('forgotAll')));
  });
  await showStore(deps);
}
