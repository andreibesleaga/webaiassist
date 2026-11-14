// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createTabReader, TAB_LEFT_TEXT } from '../../src/adapters/explorer-tab-reader';
import type { SiteReadDeps, SiteScripting } from '../../src/adapters/site-files';
import type { PageFileRequest } from '../../src/adapters/site-page-scripts';

const ORIGIN = 'https://node.test';
const TARGET = { tabId: 3, origin: ORIGIN };
const timer = () => ({ done: new Promise<void>(() => undefined), cancel: () => undefined });

function deps(origins: string[]): { deps: SiteReadDeps; asked: PageFileRequest[] } {
  const asked: PageFileRequest[] = [];
  const scripting: SiteScripting = {
    executeScript: (injection) => {
      const request = injection.args?.[0] as PageFileRequest;
      asked.push(request);
      const origin = origins[asked.length - 1] ?? origins.at(-1) ?? ORIGIN;
      return Promise.resolve([
        {
          result: {
            type: request.type ?? 'site/file',
            id: request.id,
            origin,
            status: 200,
            contentType: 'application/json',
            link: '',
            text: '{}',
            cut: false,
          },
        },
      ]);
    },
  };
  return { deps: { scripting, timer }, asked };
}

describe('the tab reader of the explorer page', () => {
  it('reads the linkset as a site file and the others as graph files', async () => {
    const fake = deps([ORIGIN]);
    const read = createTabReader(fake.deps, TARGET);
    expect(await read('linkset')).toMatchObject({ state: 'found' });
    expect(await read('graph-jsonld')).toMatchObject({ state: 'found' });
    expect(fake.asked.map((request) => [request.id, request.type])).toEqual([
      ['linkset', undefined],
      ['graph-jsonld', 'site/graph-file'],
    ]);
  });

  it('says the tab left the site once, and then sends nothing more', async () => {
    const fake = deps([ORIGIN, 'https://other.test']);
    const read = createTabReader(fake.deps, TARGET);
    await read('linkset');
    await expect(read('graph-jsonld')).rejects.toThrow(TAB_LEFT_TEXT);
    await expect(read('chunks')).rejects.toThrow(TAB_LEFT_TEXT);
    expect(fake.asked).toHaveLength(2);
  });
});
