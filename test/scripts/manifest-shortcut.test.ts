// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkManifest } from '../../scripts/check-dist.mjs';

const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8')) as {
  commands?: Record<string, { suggested_key?: { default?: string }; description?: string }>;
  permissions: string[];
};
const worker = readFileSync('src/entries/service-worker.ts', 'utf8');

describe('the keyboard shortcut that opens the side panel', () => {
  it('is the standard toolbar-button command, with a suggested key and a description', () => {
    expect(Object.keys(manifest.commands ?? {})).toEqual(['_execute_action']);
    expect(manifest.commands?._execute_action?.suggested_key?.default).toBe('Alt+Shift+A');
    expect(manifest.commands?._execute_action?.description).toBeTruthy();
  });

  it('adds no permission and passes the build check', () => {
    expect(manifest.permissions).not.toContain('commands');
    expect(checkManifest(manifest, () => true)).toEqual([]);
  });

  it('runs the existing toolbar-click path: the one onClicked listener', () => {
    // Chrome fires action.onClicked for _execute_action when the action has no popup.
    expect(manifest).not.toHaveProperty('action.default_popup');
    expect(worker.match(/onClicked\.addListener/g)).toHaveLength(1);
    expect(worker).toContain('onActionClick(ACTION_DEPS, tab)');
  });
});
