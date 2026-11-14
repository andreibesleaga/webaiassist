// SPDX-License-Identifier: Apache-2.0
// The two functions that run inside the open tab, in the extension's isolated world, through
// chrome.scripting.executeScript. A function that is injected is serialised, so each one is
// self-contained: it reads only browser globals and its argument, and holds its own limits.
// They send back plain data; the panel checks every answer against its schema (site/file,
// site/page) before using any of it. The page cannot read this world's variables.
//
// Rules that hold for every request (research note, F2 and F3): the address is the tab's own
// origin plus a path from the extension's fixed list, GET only, no cookies, no referrer, no
// cache, no redirect, a time limit, and the body is read in chunks and stopped at the cap.

export interface PageFileRequest {
  readonly id: string;
  /** From the fixed list in src/core/site-files.ts, never from a page or a file. */
  readonly path: string;
  /** The origin the panel believes the tab is on; the script refuses to run elsewhere. */
  readonly origin: string;
  readonly accept: string;
  readonly maxBytes: number;
  readonly timeoutMs: number;
}

/* eslint-disable max-lines-per-function -- an injected function cannot call code outside itself */

/** One GET of one site file. Always resolves with a `site/file` message. */
export async function fetchSiteFile(request: PageFileRequest): Promise<unknown> {
  const answer = (change: Record<string, unknown>): Record<string, unknown> => ({
    type: 'site/file',
    id: request.id,
    origin: location.origin,
    status: 0,
    contentType: '',
    link: '',
    text: '',
    cut: false,
    ...change,
  });
  const readBody = async (response: Response): Promise<{ text: string; cut: boolean }> => {
    const reader = response.body?.getReader();
    if (!reader) return { text: '', cut: false };
    const chunks: Uint8Array[] = [];
    let size = 0;
    let cut = Number(response.headers.get('content-length')) > request.maxBytes;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const room = request.maxBytes - size;
      chunks.push(value.length > room ? value.slice(0, room) : value);
      size += Math.min(value.length, room);
      if (value.length > room) {
        cut = true;
        await reader.cancel();
        break;
      }
    }
    return { text: await new Blob(chunks as BlobPart[]).text(), cut };
  };
  const ownPath = /^\/[A-Za-z0-9._/-]*$/.test(request.path) && !request.path.startsWith('//');
  if (location.origin !== request.origin || !ownPath) return answer({ failed: 'network' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(`${location.origin}${request.path}`, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      mode: 'same-origin',
      headers: { Accept: request.accept },
      signal: controller.signal,
    });
    const body = await readBody(response);
    return answer({
      status: response.status,
      contentType: (response.headers.get('content-type') ?? '').slice(0, 200),
      link: (response.headers.get('link') ?? '').slice(0, 2000),
      ...body,
    });
  } catch {
    return answer({ failed: controller.signal.aborted ? 'timeout' : 'network' });
  } finally {
    clearTimeout(timer);
  }
}

/** What the open page says about itself, read from its DOM: no request is made. */
export function readPageMeta(): unknown {
  const content = (selector: string, attribute: string, limit: number): string | undefined =>
    document.querySelector(selector)?.getAttribute(attribute)?.trim().slice(0, limit) || undefined;
  const defined = (entries: [string, string | undefined][]): Record<string, string> =>
    Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as Record<
      string,
      string
    >;
  const kinds = ['describedby', 'alternate', 'license', 'api-catalog', 'service-desc'];
  const links = Array.from(document.querySelectorAll('link[href][rel]'))
    .map((link) => ({
      rel: kinds.find((kind) =>
        link.getAttribute('rel')?.toLowerCase().split(/\s+/).includes(kind),
      ),
      href: (link as HTMLLinkElement).href.slice(0, 500),
      type: link.getAttribute('type')?.slice(0, 100) ?? undefined,
    }))
    .filter((link) => link.rel !== undefined)
    .slice(0, 60)
    .map((link) => defined(Object.entries(link)));
  const tdm = content('meta[name="tdm-reservation"]', 'content', 1);
  return {
    type: 'site/page',
    origin: location.origin,
    title: document.title.slice(0, 1000),
    ...defined([
      ['language', document.documentElement.lang.slice(0, 35) || undefined],
      ['description', content('meta[name="description"]', 'content', 500)],
      ['tdm', tdm === '0' || tdm === '1' ? tdm : undefined],
    ]),
    og: defined([
      ['title', content('meta[property="og:title"]', 'content', 500)],
      ['description', content('meta[property="og:description"]', 'content', 500)],
      ['type', content('meta[property="og:type"]', 'content', 100)],
      ['siteName', content('meta[property="og:site_name"]', 'content', 200)],
    ]),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .slice(0, 5)
      .map((script) => (script.textContent ?? '').slice(0, 32768)),
    links,
  };
}
