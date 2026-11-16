// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { forgetAllSites, forgetSite } from '../../src/adapters/forget-site';
import { withActivity } from '../../src/adapters/forget-activity';
import { InMemoryActivity } from '../../src/fakes/in-memory-activity';
import { InMemoryMemory } from '../../src/fakes/in-memory-memory';
import { record } from '../helpers-activity';

const A = 'https://a.example';
const B = 'https://b.example';

async function setup() {
  const log = new InMemoryActivity();
  await log.append(record({ id: '1', origin: A }));
  await log.append(record({ id: '2', origin: B }));
  const memory = new InMemoryMemory();
  return { log, memory: withActivity(memory, log) };
}

describe('forgetting and the activity log', () => {
  it('"Forget this site" removes the entries of that site only', async () => {
    const { log, memory } = await setup();
    await forgetSite(
      {
        memory,
        grants: { remove: () => Promise.resolve() },
        allowed: { remove: () => Promise.resolve() },
        compat: { unregister: () => Promise.resolve(), removeOrigins: () => Promise.resolve(true) },
      },
      A,
    );
    expect((await log.list()).map((r) => r.id)).toEqual(['2']);
  });

  it('"Forget all sites" removes every entry', async () => {
    const { log, memory } = await setup();
    await forgetAllSites({
      memory,
      grants: { clear: () => Promise.resolve() },
      allowed: { clear: () => Promise.resolve() },
      endpointHosts: { clear: () => Promise.resolve() },
      compat: {
        unregisterAll: () => Promise.resolve(),
        grantedOrigins: () => Promise.resolve([]),
        removeOrigins: () => Promise.resolve(true),
      },
      keep: [],
    });
    expect(await log.list()).toEqual([]);
  });
});
