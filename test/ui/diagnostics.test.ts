// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// "Copy diagnostics": a preview of exactly what is copied, copied on a second click, with no
// page text, no key and no address.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/adapters/settings';
import { byId, click, loadPage, tick } from './dom';
import { fake } from './options-fakes';
import { fakeDeps, ORIGIN } from './panel-fakes';
import { fakeClock, flush, open, startModel } from './site-helpers';
import { startOptions } from '../../src/ui/options-page';

const KEY = 'sk-test-ABCDEF1234567890abcdef';
const preview = (): string => byId('diag-preview').textContent ?? '';

describe('Copy diagnostics in the panel', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a preview first, copies nothing, and copies exactly that text on the second click', async () => {
    const deps = fakeDeps(['x']);
    deps.env = {
      ...deps.env,
      webgpu: true,
      shaderF16: true,
      gpuKey: 'nvidia/ada',
      builtIn: 'available',
    };
    await open(deps);
    await startModel();
    click('diagnostics');
    await flush();
    expect(byId('diag-box').hidden).toBe(false);
    expect(preview()).toContain('Extension: 0.1.0');
    expect(preview()).toContain('WebGPU: adapter vendor nvidia, architecture ada; shader-f16 yes');
    expect(preview()).toContain('Chrome built-in model: available');
    expect(preview()).toContain('WebMCP on the open tab: present, 10 tools');
    expect(preview()).toContain('Model: ');
    expect(deps.copied).toEqual([]);
    const shown = preview();
    click('diagnostics');
    await flush();
    expect(deps.copied).toEqual([shown]);
    expect(byId('page-note').textContent).toContain('copied');
  });

  it('holds no page text, no page title, no key and no address, even after an error that names them', async () => {
    const deps = fakeDeps(['x']);
    deps.settings = {
      ...DEFAULT_SETTINGS,
      endpoint: { ...DEFAULT_SETTINGS.endpoint, apiKey: KEY },
    };
    const panel = await open(deps);
    click('read-page');
    await flush();
    panel.report(new Error(`failed at https://api.example.com/v1 with ${KEY}.`));
    click('diagnostics');
    await flush();
    expect(preview()).not.toContain(KEY);
    expect(preview()).not.toContain('api.example.com');
    expect(preview()).not.toContain('Cats');
    expect(preview()).not.toContain(ORIGIN);
    expect(preview()).toContain('Last error: ');
  });

  it('adds the site host only when the box is ticked, and the preview follows the box', async () => {
    const deps = fakeDeps(['x']);
    await open(deps);
    click('diagnostics');
    await flush();
    expect(preview()).not.toContain('Site host');
    byId<HTMLInputElement>('diag-host').click();
    await flush();
    expect(preview()).toContain('Site host: node.example');
    expect(deps.copied).toEqual([]);
  });

  it('says whether the page has no WebMCP in this browser, or none registered', async () => {
    const deps = fakeDeps(['x']);
    deps.bridge.pageResult = { origin: ORIGIN, linkset: false, tools: [], webmcp: false };
    await open(deps);
    click('diagnostics');
    await flush();
    expect(preview()).toContain('WebMCP on the open tab: not in this browser');
  });
});

describe('Copy diagnostics on the Options page', () => {
  beforeEach(() => loadPage('options.html'));

  it('shows a preview and copies it on the second click; no host box here', async () => {
    const deps = fake();
    const copied: string[] = [];
    deps.copyText = (text) => {
      copied.push(text);
      return Promise.resolve();
    };
    deps.diagnostics = (host) =>
      Promise.resolve({
        version: '0.1.0',
        browser: 'Chrome/157',
        webmcp: 'not checked here',
        ...(host ? { host: 'x' } : {}),
      });
    await startOptions(deps);
    expect(document.getElementById('diag-host')).toBeNull();
    click('diagnostics');
    await tick();
    await tick();
    expect(byId('diag-preview').textContent).toContain('Browser: Chrome/157');
    expect(copied).toEqual([]);
    click('diagnostics');
    await tick();
    expect(copied).toEqual([byId('diag-preview').textContent]);
  });
});
