// SPDX-License-Identifier: Apache-2.0
// Checks that the public documents say what the code does: permissions, hosts, dependencies,
// models, limits and governance. Each test proves one scenario of features/17 and 20.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CPU_MODELS } from '../../src/adapters/cpu-models';
import { WEBLLM_MODEL_IDS } from '../../src/adapters/models';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
/** One line of text: quote marks and line breaks of the store text removed. */
const flat = (text: string): string => text.replace(/\n>?\s*/g, ' ');

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(ROOT, path)).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('F20.4 no source file writes HTML into a page', () => {
  it('uses none of innerHTML, outerHTML or insertAdjacentHTML', () => {
    const files = [...sourceFiles('src'), ...sourceFiles('static')].filter((p) =>
      /\.(ts|js|html|mjs)$/.test(p),
    );
    const found = files.filter((p) => /innerHTML|outerHTML|insertAdjacentHTML/.test(read(p)));
    expect(found).toEqual([]);
  });
});

describe('F20.5 the manifest permissions equal the documented list', () => {
  const listing = read('docs/STORE-LISTING.md');
  const table = listing.slice(listing.indexOf('**Permission justifications:**'));
  const rows = table
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| --'));
  const documented = rows.slice(1).map((row) => row.split('|')[1] ?? '');

  it('names every permission and every optional host pattern of the manifest', () => {
    const manifest = JSON.parse(read('static/manifest.json')) as {
      permissions: string[];
      optional_host_permissions: string[];
      host_permissions?: string[];
    };
    expect(manifest.host_permissions).toBeUndefined();
    for (const name of manifest.permissions) {
      expect(
        documented.some((cell) => cell.includes(`\`${name}\``)),
        name,
      ).toBe(true);
    }
    for (const pattern of manifest.optional_host_permissions) {
      expect(documented.join(' '), pattern).toContain(pattern);
    }
  });

  it('documents no permission that the manifest does not have', () => {
    const manifest = JSON.parse(read('static/manifest.json')) as { permissions: string[] };
    const names = documented
      .map((cell) => /^\s*`(\w+)`\s*$/.exec(cell)?.[1])
      .filter((name): name is string => name !== undefined);
    expect(names.sort()).toEqual([...manifest.permissions].sort());
  });
});

describe('F20.6 the governance documents exist and name every dependency and model', () => {
  const readme = read('README.md');

  it('has SECURITY.md, the threat model and the sources list, linked from the README', () => {
    for (const path of ['SECURITY.md', 'docs/THREAT-MODEL.md', 'docs/SOURCES.md']) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
      expect(readme, path).toContain(`](${path})`);
    }
  });

  it('lists every runtime dependency in the sources list', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    const sources = read('docs/SOURCES.md');
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      expect(sources, name).toContain(`\`${name}\``);
      expect(sources, `${name} ${version}`).toContain(version);
    }
  });

  it('lists every model the extension offers in the sources list', () => {
    const sources = read('docs/SOURCES.md');
    for (const id of WEBLLM_MODEL_IDS) expect(sources, id).toContain(id);
    for (const model of CPU_MODELS) expect(sources, model.id).toContain(model.sha256);
  });
});

describe('F20.7 the store listing and the README state the limits', () => {
  for (const path of ['README.md', 'docs/STORE-LISTING.md']) {
    it(`${path} says WebMCP is a draft, Chromium is needed, answers can be wrong`, () => {
      const text = flat(read(path));
      expect(/WebMCP is a draft/i.test(text), 'draft').toBe(true);
      expect(/Chromium/.test(text), 'Chromium').toBe(true);
      expect(/answers can be wrong/i.test(text), 'can be wrong').toBe(true);
    });

    it(`${path} states the result of the built-in model test`, () => {
      expect(/built-in model test:/i.test(flat(read(path)))).toBe(true);
    });
  }
});

describe('F20.8 the governance note', () => {
  it('names the provider and the deployer and excludes high-risk uses', () => {
    const text = read('docs/GOVERNANCE.md').toLowerCase();
    for (const word of ['provider', 'deployer', 'biometric', 'emotion', 'high-risk']) {
      expect(text, word).toContain(word);
    }
    expect(read('README.md')).toContain('](docs/GOVERNANCE.md)');
  });
});

describe('F20.11 the threat model and the security policy', () => {
  it('has a Residual risks section and a reporting path', () => {
    expect(read('docs/THREAT-MODEL.md')).toMatch(/^## Residual risks$/m);
    expect(read('SECURITY.md')).toMatch(/Report a vulnerability/);
  });
});

describe('F17.2 and F20.12 every host in the code is in the privacy page', () => {
  const dist = join(ROOT, 'dist');
  const built = existsSync(join(dist, 'manifest.json'));

  function bundles(): string[] {
    return sourceFiles('dist').filter((p) => /\.(js|html)$/.test(p) && !p.includes('model-libs'));
  }

  it.runIf(built)('names each web address of the bundles in docs/PRIVACY.md', () => {
    const privacy = read('docs/PRIVACY.md');
    const hosts = new Set<string>();
    for (const file of bundles()) {
      for (const match of read(file).matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        hosts.add(match[1] ?? '');
      }
    }
    expect(hosts.size).toBeGreaterThan(0);
    for (const host of hosts) expect(privacy, host).toContain(host);
  });

  it('records why the manifest has no connect-src list', () => {
    const model = read('docs/THREAT-MODEL.md');
    expect(model).toMatch(/connect-src/);
    expect(model).toMatch(/no `connect-src` list/);
  });
});

describe('audit L5 the public texts state what the code does', () => {
  it('PRIVACY.md says the saved chat holds tool results and read page text', () => {
    const text = flat(read('docs/PRIVACY.md'));
    expect(text).toMatch(
      /Chat per site, with the tool results and the page text you read with Read this page/,
    );
  });

  it('PRIVACY.md says a toolbar click starts the eight site-file reads', () => {
    const text = flat(read('docs/PRIVACY.md'));
    expect(text).toMatch(/toolbar (button|click)[^|]*eight files|eight files[^|]*toolbar/i);
    expect(text).toContain('A toolbar click on a page');
  });

  it('PRIVACY.md and the panel say results of a site’s own tools still reach the model', () => {
    expect(flat(read('docs/PRIVACY.md'))).toMatch(
      /Results of the site.s own tools still go to the model/,
    );
  });

  it('GOVERNANCE.md names the per-site exception to "every call asks"', () => {
    const text = flat(read('docs/GOVERNANCE.md'));
    expect(text).toMatch(/per-site mode/);
    expect(text).toMatch(/read-only runs without a question/);
  });

  it('GOVERNANCE.md describes the export mark, endpoint included', () => {
    const text = flat(read('docs/GOVERNANCE.md'));
    expect(text).toContain('ai-generated: true');
    expect(text).toMatch(/endpoint host/);
    expect(text).not.toMatch(/written by a local AI model through/);
  });
});
