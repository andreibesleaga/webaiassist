// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileOutcome } from '../../src/core/site-files';
import { AGSC_PROFILE } from '../../src/core/site-linkset';
import { graphTab } from '../../src/ui/explorer/graph-tab';
import type { ExplorerContext } from '../../src/ui/explorer/tabs';

const fixture = (name: string): string => readFileSync(`fixtures/graph/${name}`, 'utf8');
const ORIGIN = 'https://agenticsystemcore.com';
const TYPE = `application/linkset+json; profile="${AGSC_PROFILE}"`;

const found = (text: string, contentType = TYPE): FileOutcome => ({
  state: 'found',
  text,
  cut: false,
  link: '',
  contentType,
});

function setup(outcome: FileOutcome) {
  document.body.innerHTML =
    '<p id="graph-note" hidden></p><div id="panel-graph"><input type="checkbox" id="gx-depth"></div>';
  const approved = new Set<string>();
  const ctx: ExplorerContext = {
    doc: document,
    target: { tabId: 1, origin: ORIGIN },
    readTab: () => Promise.resolve(outcome),
    approved,
  };
  const root = document.getElementById('panel-graph') as HTMLElement;
  graphTab.mount(root, ctx);
  return { root, approved };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => document.body.replaceChildren());

describe('the Graph tab', () => {
  it('lists the peer the node names and reads nothing yet', async () => {
    const { root, approved } = setup(found(fixture('asc-linkset.json')));
    await settle();
    expect(root.querySelector('.peers')).not.toBeNull();
    expect(root.querySelector('label')?.textContent).toBe('https://patterns.agenticsystemcore.com');
    expect(approved.size).toBe(0);
    expect((document.getElementById('gx-depth') as HTMLInputElement).checked).toBe(false);
  });

  it('after the button: approves the ticked origin and makes the explorer read its peers', async () => {
    const { root, approved } = setup(found(fixture('asc-linkset.json')));
    await settle();
    const changed = vi.fn();
    document.getElementById('gx-depth')?.addEventListener('change', changed);
    (root.querySelector('input[type="checkbox"][data-origin]') as HTMLInputElement).click();
    (root.querySelector('.peers button') as HTMLButtonElement).click();
    expect([...approved]).toEqual(['https://patterns.agenticsystemcore.com']);
    expect(changed).toHaveBeenCalledTimes(1);
    expect((document.getElementById('gx-depth') as HTMLInputElement).checked).toBe(true);
  });

  it('has no peers block for a node that names no peer', async () => {
    const { root } = setup(
      found(
        fixture('pat-linkset.json').replaceAll(
          'patterns.agenticsystemcore.com',
          'agenticsystemcore.com',
        ),
      ),
    );
    await settle();
    expect(root.querySelector('.peers')).toBeNull();
  });

  const missing: [string, FileOutcome][] = [
    ['a site with no link set', { state: 'not-published' }],
    [
      'a link set without the node profile',
      found(fixture('asc-linkset.json'), 'application/linkset+json'),
    ],
    ['a link set that is not JSON', found('<html>')],
  ];
  it.each(missing)('says there is no graph to show for %s', async (_name, outcome) => {
    setup(outcome);
    await settle();
    const note = document.getElementById('graph-note') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toMatch(/no graph to show/);
  });

  it('says when the node keeps its graph somewhere else', async () => {
    const moved = fixture('asc-linkset.json').replace(
      `${ORIGIN}/graph.jsonld`,
      `${ORIGIN}/data/graph.jsonld`,
    );
    setup(found(moved));
    await settle();
    expect(document.getElementById('graph-note')?.textContent).toMatch(/standard place/);
  });
});
