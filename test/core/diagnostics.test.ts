// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { cleanError, diagnosticsText, type DiagnosticsFacts } from '../../src/core/diagnostics';

const FACTS: DiagnosticsFacts = {
  version: '0.1.0',
  browser: 'Chrome/157.0.0.0',
  model: 'Gemma 4 E2B',
  where: 'in this browser, on the graphics card',
  gpu: { vendor: 'nvidia', architecture: 'ada', shaderF16: true },
  builtIn: 'available',
  webmcp: 'present, 10 tools',
  lastError: 'The model stopped.',
};

describe('diagnosticsText', () => {
  it('lists version, browser, model and where it runs, adapter, built-in state, WebMCP, last error', () => {
    const text = diagnosticsText(FACTS, []);
    expect(text).toContain('Extension: 0.1.0');
    expect(text).toContain('Browser: Chrome/157.0.0.0');
    expect(text).toContain('Model: Gemma 4 E2B, runs in this browser, on the graphics card');
    expect(text).toContain('WebGPU: adapter vendor nvidia, architecture ada; shader-f16 yes');
    expect(text).toContain('Chrome built-in model: available');
    expect(text).toContain('WebMCP on the open tab: present, 10 tools');
    expect(text).toContain('Last error: The model stopped.');
  });

  it('says so when there is no adapter, no model and no error', () => {
    const text = diagnosticsText(
      { version: '0.1.0', browser: 'Chrome/157', webmcp: 'no page' },
      [],
    );
    expect(text).toContain('WebGPU: no adapter');
    expect(text).toContain('Model: not started');
    expect(text).toContain('Last error: none');
    expect(text).not.toContain('Site host');
  });

  it('names the site host only when the facts carry one', () => {
    expect(diagnosticsText({ ...FACTS, host: 'example.com' }, [])).toContain(
      'Site host: example.com',
    );
  });

  it('never carries a key, an address or text beyond the cap, even inside the last error', () => {
    const error =
      'failed at https://api.example.com/v1/chat?key=abc with Bearer sk-live-1234567890abcdef1234 and hunter2key';
    const text = diagnosticsText({ ...FACTS, lastError: error }, ['hunter2key']);
    expect(text).not.toContain('sk-live');
    expect(text).not.toContain('hunter2key');
    expect(text).not.toContain('api.example.com');
    expect(text).toContain('[address]');
    expect(cleanError('x'.repeat(1000), []).length).toBeLessThanOrEqual(300);
  });

  it('ignores a secret that is too short to be one', () => {
    expect(cleanError('a b c', ['a'])).toBe('a b c');
  });

  it('keeps only one line per value (no page text can hide behind a line break)', () => {
    const text = diagnosticsText({ ...FACTS, model: 'A\nPage text: secret' }, []);
    expect(text.split('\n').filter((line) => line.startsWith('Page text'))).toEqual([]);
  });
});
