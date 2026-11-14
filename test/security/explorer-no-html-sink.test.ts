// SPDX-License-Identifier: Apache-2.0
// Data from a node (graph, linkset, chunks, peers) is untrusted text. The site's explorer code and
// everything WebAIAssist wrote around it must have no way to turn a string into HTML or code. A
// site update that adds one fails here when it is synced.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');
const SINKS = /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/;

function files(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(process.cwd(), path)).isDirectory() ? files(path) : [path];
  });
}

describe('the explorer has no HTML or code sink', () => {
  const own = [
    ...files('src/ui/explorer'),
    'src/entries/explorer.ts',
    'src/adapters/graph-fetch-shim.ts',
    'src/adapters/graph-files.ts',
    'src/adapters/explorer-tab-reader.ts',
    'src/adapters/graph-fetch-guard.ts',
    'src/core/graph-files.ts',
    'src/adapters/linkset-digests.ts',
    'src/ui/explorer-url.ts',
    'src/adapters/peers.ts',
    'static/explorer.html',
  ];
  const copied = ['graph-data.js', 'graph-explorer.js'].map(
    (name) => `third_party/agsc-explorer/${name}`,
  );

  it.each([...own, ...copied])(
    '%s uses none of innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function',
    (path) => {
      expect(read(path)).not.toMatch(SINKS);
    },
  );

  it('the copied scanners really read the copies (a planted sink is found)', () => {
    expect(SINKS.test('el.innerHTML = x')).toBe(true);
    expect(SINKS.test('const f = new Function("x")')).toBe(true);
    expect(SINKS.test('el.textContent = x')).toBe(false);
  });

  it('force-graph has no eval and no new Function, and the explorer turns its HTML labels off', () => {
    const library = read('node_modules/force-graph/dist/force-graph.min.js');
    expect(library).not.toMatch(/(^|[^\w.$])eval\s*\(|new Function/);
    // The library would render a node's label as HTML: the explorer gives it an empty label instead
    // and draws names itself with canvas text and textContent.
    expect(read('third_party/agsc-explorer/graph-explorer.js')).toContain(
      "nodeLabel(() => '').linkLabel(() => '')",
    );
  });

  it('every link the explorer shows is checked to be http or https by the site code', () => {
    const data = read('third_party/agsc-explorer/graph-data.js');
    expect(data).toContain("if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;");
  });
});
