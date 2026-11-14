// SPDX-License-Identifier: Apache-2.0
// A static server for the conformance/ folder on two loopback hosts: 127.0.0.1 (the page under
// test) and 127.0.0.2 (the other origin of the cross-origin frame in case C14). It is separate
// from test/smoke/harness.ts (which serves the smoke-test pages; test/smoke/conformance-server.ts re-exports this file) and serves the files exactly as they are,
// so what the tests see is what a static host such as GitHub Pages would serve.
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';

export const CONFORMANCE_DIR = join(process.cwd(), 'conformance');
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export interface ConformanceServer {
  /** The page under test: http://127.0.0.1:<port>. */
  readonly origin: string;
  /** The same folder at another origin: http://127.0.0.2:<port>. */
  readonly otherOrigin: string;
  /** Every path requested, in order (both hosts). */
  readonly requests: string[];
  close(): Promise<void>;
}

/** The file for a URL path inside `root`, or undefined when it would leave the folder. */
export function fileFor(root: string, urlPath: string): string | undefined {
  const clean = normalize(decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath));
  const full = join(root, clean);
  return full.startsWith(root + sep) ? full : undefined;
}

function listen(requests: string[], host: string): Promise<Server> {
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0] ?? '/';
    requests.push(path);
    const file = fileFor(CONFORMANCE_DIR, path);
    if (!file) return void response.writeHead(403).end();
    readFile(file).then(
      (body) =>
        response
          .writeHead(200, {
            'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
            'cache-control': 'no-store',
          })
          .end(body),
      () => void response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'),
    );
  });
  return new Promise((resolve) => server.listen(0, host, () => resolve(server)));
}

/** `unref` lets a test process end without closing the servers (the BDD steps have no hook for it). */
export async function startConformanceServer(
  options: { unref?: boolean } = {},
): Promise<ConformanceServer> {
  const requests: string[] = [];
  const first = await listen(requests, '127.0.0.1');
  const second = await listen(requests, '127.0.0.2');
  if (options.unref) {
    first.unref();
    second.unref();
  }
  const close = (server: Server): Promise<void> =>
    new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  return {
    origin: `http://127.0.0.1:${(first.address() as AddressInfo).port}`,
    otherOrigin: `http://127.0.0.2:${(second.address() as AddressInfo).port}`,
    requests,
    close: async () => {
      await Promise.all([close(first), close(second)]);
    },
  };
}
