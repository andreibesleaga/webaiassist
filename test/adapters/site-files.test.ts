// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readPageData,
  readSiteFile,
  readSiteFiles,
  type SiteReadDeps,
  type SiteScripting,
  type Timer,
} from '../../src/adapters/site-files';
import { LIMITS, SITE_FILES, specOf } from '../../src/core/site-files';
import type { PageFileRequest } from '../../src/adapters/site-page-scripts';

const ORIGIN = 'https://site.test';
const TARGET = { tabId: 7, origin: ORIGIN };

/** A reply of the page script. */
function reply(request: PageFileRequest, change: Record<string, unknown> = {}): unknown {
  return {
    type: 'site/file',
    id: request.id,
    origin: ORIGIN,
    status: 200,
    contentType: 'text/plain',
    link: '',
    text: `# ${request.id}`,
    cut: false,
    ...change,
  };
}

interface Fake extends SiteReadDeps {
  readonly asked: PageFileRequest[];
  readonly injections: { target: { tabId: number }; world: string }[];
}

function fake(answer: (request: PageFileRequest) => unknown): Fake {
  const asked: PageFileRequest[] = [];
  const injections: Fake['injections'] = [];
  const scripting: SiteScripting = {
    executeScript: async (injection) => {
      injections.push({ target: injection.target, world: injection.world });
      const request = injection.args?.[0] as PageFileRequest;
      asked.push(request);
      return [{ result: await answer(request) }];
    },
  };
  const timer = (ms: number): Timer => {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const done = new Promise<void>((resolve) => {
      handle = setTimeout(resolve, ms);
    });
    return { done, cancel: () => clearTimeout(handle) };
  };
  return { scripting, timer, asked, injections };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('readSiteFile', () => {
  it('runs one script in the isolated world of the tab, with limits from the fixed list', async () => {
    const deps = fake((request) => reply(request));
    const outcome = await readSiteFile(deps, TARGET, specOf('llms'));
    expect(outcome).toMatchObject({ state: 'found', text: '# llms' });
    expect(deps.injections).toEqual([{ target: { tabId: 7 }, world: 'ISOLATED' }]);
    expect(deps.asked[0]).toEqual({
      id: 'llms',
      path: '/llms.txt',
      origin: ORIGIN,
      accept: 'text/plain, text/markdown',
      maxBytes: 64 * 1024,
      timeoutMs: 5000,
    });
  });

  it('refuses an answer for another file, from another origin, or in the wrong shape', async () => {
    const wrongId = fake((request) => reply(request, { id: 'robots' }));
    const wrongOrigin = fake((request) => reply(request, { origin: 'https://evil.test' }));
    const extra = fake((request) => reply(request, { script: 'x' }));
    const junk = fake(() => 'text');
    for (const deps of [wrongId, wrongOrigin, extra, junk]) {
      expect(await readSiteFile(deps, TARGET, specOf('llms'))).toEqual({
        state: 'not-usable',
        why: 'parse',
      });
    }
  });

  it('is "unavailable" when the script cannot run (access lost) or throws', async () => {
    const deps = fake(() => {
      throw new Error('Cannot access contents of the page');
    });
    expect(await readSiteFile(deps, TARGET, specOf('llms'))).toEqual({
      state: 'unavailable',
      why: 'network',
    });
  });

  it('is "unavailable" when the script never answers, after the limit and a margin', async () => {
    const deps = fake(() => new Promise(() => undefined));
    const pending = readSiteFile(deps, TARGET, specOf('llms'));
    await vi.advanceTimersByTimeAsync(LIMITS.fileMs + 1000);
    expect(await pending).toEqual({ state: 'unavailable', why: 'timeout' });
  });

  it('judges the page script status, type and size', async () => {
    const html = fake((request) => reply(request, { contentType: 'text/html' }));
    expect(await readSiteFile(html, TARGET, specOf('llms'))).toEqual({
      state: 'not-usable',
      why: 'type',
    });
    const missing = fake((request) => reply(request, { status: 404, contentType: 'text/html' }));
    expect(await readSiteFile(missing, TARGET, specOf('llms'))).toEqual({ state: 'not-published' });
  });
});

describe('readSiteFiles', () => {
  it('reads each file of the list once, at most eight, two at a time', async () => {
    let running = 0;
    let most = 0;
    const deps = fake(async (request) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running -= 1;
      return reply(request);
    });
    const pending = readSiteFiles(deps, TARGET);
    await vi.advanceTimersByTimeAsync(200);
    const outcomes = await pending;
    expect(deps.asked.map((request) => request.id).sort()).toEqual(
      SITE_FILES.map((file) => file.id).sort(),
    );
    expect(deps.asked.length).toBeLessThanOrEqual(8);
    expect(most).toBe(2);
    expect(Object.keys(outcomes)).toHaveLength(8);
  });

  it('builds every address from the tab origin and the fixed paths, never from a file', async () => {
    const llms = '# G\n## S\n- [x](https://evil.test/steal)\n- [y](/other)';
    const deps = fake((request) => reply(request, { text: llms }));
    const pending = readSiteFiles(deps, TARGET);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    const allowed = new Set(SITE_FILES.map((file) => file.path));
    for (const request of deps.asked) {
      expect(allowed.has(request.path)).toBe(true);
      expect(request.origin).toBe(ORIGIN);
    }
  });

  it('ends the whole reading after 10 seconds, and files not done count as unavailable', async () => {
    const deps = fake(() => new Promise(() => undefined));
    const pending = readSiteFiles(deps, TARGET);
    await vi.advanceTimersByTimeAsync(LIMITS.totalMs);
    const outcomes = await pending;
    expect(Object.values(outcomes).every((o) => o?.state === 'unavailable')).toBe(true);
    // Two start at once; the two that were lost at 6 seconds are replaced, then the time is up.
    expect(deps.asked).toHaveLength(4);
  });

  it('keeps what finished before the deadline', async () => {
    const deps = fake((request) =>
      request.id === 'linkset'
        ? reply(request, { contentType: 'application/json' })
        : new Promise(() => undefined),
    );
    const pending = readSiteFiles(deps, TARGET);
    await vi.advanceTimersByTimeAsync(LIMITS.totalMs);
    const outcomes = await pending;
    expect(outcomes.linkset?.state).toBe('found');
    expect(outcomes.llms?.state).toBe('unavailable');
  });
});

describe('readPageData', () => {
  const meta = {
    type: 'site/page',
    origin: ORIGIN,
    title: 'T',
    og: {},
    jsonLd: [],
    links: [],
    language: 'en',
  };

  it('returns the page reading when it is valid and from the expected origin', async () => {
    const deps = fake(() => meta);
    expect(await readPageData(deps, TARGET)).toEqual({
      title: 'T',
      og: {},
      jsonLd: [],
      links: [],
      language: 'en',
    });
  });

  it('returns nothing for another origin, a wrong shape or a failed script', async () => {
    expect(
      await readPageData(
        fake(() => ({ ...meta, origin: 'https://evil.test' })),
        TARGET,
      ),
    ).toBeUndefined();
    expect(
      await readPageData(
        fake(() => ({ ...meta, extra: 1 })),
        TARGET,
      ),
    ).toBeUndefined();
    const failing = fake(() => {
      throw new Error('no access');
    });
    expect(await readPageData(failing, TARGET)).toBeUndefined();
  });
});
