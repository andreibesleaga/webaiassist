// SPDX-License-Identifier: Apache-2.0
// A manual check against the two live nodes (not part of any test: tests never use the network).
//   node scripts/check-live-graph.mjs
// For each node it reads the linkset and graph.jsonld with a browser User-Agent (Cloudflare refuses
// Node's default one), compares the SHA-256 with the digest in the linkset, runs the site's own data
// code (third_party/agsc-explorer/graph-data.js) and prints nodes, links and connected pieces.
// Expected: digest "verified", one connected piece, the counts of the linkset as "Graph: N items".
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const NODES = ['https://agenticsystemcore.com', 'https://patterns.agenticsystemcore.com'];
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const module = { exports: {} };
runInNewContext(
  readFileSync(new URL('../third_party/agsc-explorer/graph-data.js', import.meta.url), 'utf8'),
  {
    module,
    URL,
    TextDecoder,
    AbortController,
    setTimeout,
    clearTimeout,
    Buffer,
  },
);
const G = module.exports;

async function get(url) {
  const response = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'error' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function pieces(model) {
  const seen = new Set();
  let count = 0;
  for (const node of model.nodes) {
    if (seen.has(node.id)) continue;
    count += 1;
    for (const stack = [node.id]; stack.length > 0;) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of model.adj.get(id) ?? []) stack.push(edge.id);
    }
  }
  return count;
}

for (const origin of NODES) {
  const linksetBytes = await get(`${origin}/.well-known/knowledge-linkset`);
  const about = JSON.parse(linksetBytes.toString('utf8')).linkset[0].describedby[0];
  const graphBytes = await get(`${origin}/graph.jsonld`);
  const actual = createHash('sha256').update(graphBytes).digest('base64');
  const model = G.merge([G.parseGraph(JSON.parse(graphBytes.toString('utf8')), 0, 'en')], []);
  const items = about['agsc-counts'].map((c) => Number(c.split('=')[1])).reduce((a, b) => a + b, 0);
  console.log(
    `${origin}: digest ${G.digestStatus(about.digest[0], actual)}, ${model.nodes.length} nodes, ` +
      `${model.links.length} links, ${pieces(model)} connected piece(s), chip "Graph: ${items} items"`,
  );
}
