// SPDX-License-Identifier: Apache-2.0
// Serves the built spike page (dist-smoke/spike/) on http://localhost:8080/ so it can also
// be checked as an ordinary web page. Serves only the two files of the page; run `npm run
// build:smoke` first (the spike page is in the development build only, not in dist/). Uses
// Node's own http module, so it needs no extra package.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8080);
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/spike.js': ['spike.js', 'text/javascript; charset=utf-8'],
};

createServer((request, response) => {
  const file = FILES[new URL(request.url ?? '/', 'http://localhost').pathname];
  if (!file) {
    response.writeHead(404).end('not found');
    return;
  }
  const body = readFileSync(new URL(`../dist-smoke/spike/${file[0]}`, import.meta.url));
  response.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' }).end(body);
}).listen(PORT, 'localhost', () => {
  console.log(`Spike page: http://localhost:${PORT}/  (Ctrl+C to stop)`);
});
