// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The Query, Vocabulary and Page data tabs, with a fake query session that answers as the worker does.
// Cells are text only: a hostile value of a graph stays a string and never becomes an element.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuerySession, RunOutcome } from '../../src/adapters/query-session';
import { EXAMPLES } from '../../src/query/examples';
import { QUERY_LIMITS } from '../../src/query/protocol';
import { pageDataTab, prettyBlocks } from '../../src/ui/explorer/page-data-tab';
import { queryTab, statusText } from '../../src/ui/explorer/query-tab';
import type { ExplorerContext, QueryTabDeps } from '../../src/ui/explorer/tabs';
import { vocabTab } from '../../src/ui/explorer/vocab-tab';

const literal = (value: string) => ({ type: 'literal', value });
const json = (vars: string[], rows: Record<string, unknown>[]): string =>
  JSON.stringify({ head: { vars }, results: { bindings: rows } });
const answer = (text: string, total: number, form = 'SELECT'): RunOutcome => ({
  kind: 'answer',
  reply: { type: 'answer', id: 1, form, json: text, total },
});

function session(outcomes: RunOutcome[] | (() => Promise<RunOutcome>)): QuerySession & {
  stop: ReturnType<typeof vi.fn>;
  texts: string[];
} {
  const texts: string[] = [];
  const queue = Array.isArray(outcomes) ? [...outcomes] : undefined;
  return {
    texts,
    ready: () => Promise.resolve({ ok: true, size: 1 }),
    run: (text: string) => {
      texts.push(text);
      return queue
        ? Promise.resolve(queue.shift() as RunOutcome)
        : (outcomes as () => Promise<RunOutcome>)();
    },
    stop: vi.fn<() => void>(),
    close: vi.fn<() => void>(),
  };
}

function mounted(deps: Partial<QueryTabDeps> & Pick<QueryTabDeps, 'graph'>) {
  document.body.innerHTML = '<div id="panel"></div>';
  const root = document.getElementById('panel') as HTMLElement;
  const query: QueryTabDeps = {
    vocabulary: session([]),
    pageData: () => Promise.resolve(undefined),
    ...deps,
  };
  const ctx: ExplorerContext = {
    doc: document,
    target: { tabId: 1, origin: 'https://node.example' },
    readTab: () => Promise.resolve({ state: 'not-published' }),
    approved: new Set(),
    query,
  };
  return { root, ctx };
}
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

beforeEach(() => document.body.replaceChildren());

describe('Query tab', () => {
  it('has a labelled text box with the site’s first query, Run, Stop (off), and a status line', () => {
    const { root, ctx } = mounted({ graph: session([]) });
    queryTab.mount(root, ctx);
    expect($<HTMLTextAreaElement>('query-editor').value).toContain('skos:prefLabel');
    expect(document.querySelector('label[for="query-editor"]')?.textContent).toBe('SPARQL query');
    expect($<HTMLButtonElement>('query-run').disabled).toBe(false);
    expect($<HTMLButtonElement>('query-stop').disabled).toBe(true);
    expect($('query-status').getAttribute('role')).toBe('status');
  });

  it('runs the text and shows the rows as a table, text only', async () => {
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const rows = [
      {
        item: { type: 'uri', value: 'https://w3id.org/agentic-system-core/ns#Concept' },
        name: literal(hostile),
      },
    ];
    const graph = session([answer(json(['item', 'name'], rows), 1)]);
    const { root, ctx } = mounted({ graph });
    queryTab.mount(root, ctx);
    $('query-run').click();
    await flush();
    expect(graph.texts).toHaveLength(1);
    expect($('query-status').textContent).toBe('SELECT answered with 1 rows.');
    const cells = Array.from(root.querySelectorAll('.query-result td')).map(
      (cell) => cell.textContent,
    );
    expect(cells).toEqual(['asc:Concept', `"${hostile}"`]);
    expect(root.querySelector('img, script, .query-result a')).toBeNull();
    expect(root.querySelector('caption')?.textContent).toBe('The result: 1 rows.');
    expect($<HTMLButtonElement>('query-run').disabled).toBe(false);
  });

  it('shows at most 200 rows and says how many there were', async () => {
    const rows = Array.from({ length: 250 }, (_, n) => ({ n: literal(String(n)) }));
    const { root, ctx } = mounted({ graph: session([answer(json(['n'], rows), 500)]) });
    queryTab.mount(root, ctx);
    $('query-run').click();
    await flush();
    expect(root.querySelectorAll('.query-result tbody tr')).toHaveLength(QUERY_LIMITS.tabRows);
    expect(root.querySelector('caption')?.textContent).toBe(
      'The result: 500 rows, the first 200 shown here.',
    );
  });

  it('shows the engine’s sentence when a query is refused, and no table', async () => {
    const refusal: RunOutcome = {
      kind: 'answer',
      reply: {
        type: 'answer',
        id: 1,
        form: null,
        error: 'This page only reads: an update is refused.',
      },
    };
    const { root, ctx } = mounted({ graph: session([refusal]) });
    queryTab.mount(root, ctx);
    $('query-run').click();
    await flush();
    expect($('query-status').textContent).toBe('This page only reads: an update is refused.');
    expect(root.querySelector('table')).toBeNull();
  });

  it('turns Run off and Stop on while a query runs, and Stop ends it', async () => {
    let finish: (outcome: RunOutcome) => void = () => undefined;
    const graph = session(() => new Promise<RunOutcome>((resolve) => (finish = resolve)));
    const { root, ctx } = mounted({ graph });
    queryTab.mount(root, ctx);
    $('query-run').click();
    await flush();
    expect($<HTMLButtonElement>('query-run').disabled).toBe(true);
    expect($<HTMLButtonElement>('query-stop').disabled).toBe(false);
    $('query-stop').click();
    expect(graph.stop).toHaveBeenCalledTimes(1);
    finish({ kind: 'stopped' });
    await flush();
    expect($('query-status').textContent).toBe('Stopped.');
    expect($<HTMLButtonElement>('query-run').disabled).toBe(false);
  });

  it('says plainly when the time limit ended the query', () => {
    expect(statusText({ kind: 'timeout' })).toBe(
      'The query took longer than 10 seconds and was stopped. Add LIMIT or ask for less.',
    );
    expect(statusText({ kind: 'failed', text: 'The graph could not be read.' })).toBe(
      'The graph could not be read.',
    );
    expect(statusText(answer('{"head":{},"boolean":false}', 0, 'ASK'))).toBe('ASK answered no.');
  });

  it('lists the ten questions; "Put in editor" fills the box and does not run', async () => {
    const graph = session([]);
    const { root, ctx } = mounted({ graph });
    queryTab.mount(root, ctx);
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.query-examples button'));
    expect(buttons).toHaveLength(10);
    expect(buttons[0]?.getAttribute('aria-label')).toBe(`Put in editor: ${EXAMPLES[0]?.question}`);
    buttons[7]?.click();
    await flush();
    expect($<HTMLTextAreaElement>('query-editor').value).toBe(EXAMPLES[7]?.sparql);
    expect(graph.texts).toEqual([]);
  });

  it('shows nothing when the page has no query dependencies', () => {
    const { root, ctx } = mounted({ graph: session([]) });
    queryTab.mount(root, { ...ctx, query: undefined });
    expect(root.children).toHaveLength(0);
  });
});

describe('Vocabulary tab', () => {
  const linkset = JSON.stringify({
    linkset: [
      {
        anchor: 'https://node.example/',
        'https://w3id.org/agentic-system-core/rel#ontology': [
          { href: 'https://node.example/ns/agsc.ttl', type: 'text/turtle' },
        ],
        'https://w3id.org/agentic-system-core/rel#context': [
          { href: 'https://other.example/ctx.jsonld' },
        ],
      },
    ],
  });

  it('reads nothing until its tab is shown, then fills two tables and the own files, as text', async () => {
    const classes = json(
      ['iri', 'label', 'comment'],
      [
        {
          iri: { type: 'uri', value: 'https://w3id.org/agentic-system-core/ns#Concept' },
          comment: literal('<b>x</b>'),
        },
      ],
    );
    const properties = json(['iri', 'label', 'domain', 'range'], []);
    const vocabulary = session([answer(classes, 1), answer(properties, 0)]);
    const { root, ctx } = mounted({ graph: session([]), vocabulary });
    root.hidden = true;
    const withLinkset: ExplorerContext = {
      ...ctx,
      readTab: () =>
        Promise.resolve({
          state: 'found',
          text: linkset,
          cut: false,
          link: '',
          contentType: 'application/linkset+json',
        }),
    };
    vocabTab.mount(root, withLinkset);
    await flush();
    expect(vocabulary.texts).toEqual([]);
    root.hidden = false;
    await flush();
    await flush();
    expect(vocabulary.texts).toHaveLength(2);
    expect(root.querySelector('caption')?.textContent).toBe('Classes');
    expect(root.querySelector('tbody td')?.textContent).toBe('asc:Concept');
    expect(root.querySelector('b')).toBeNull();
    const own = Array.from(root.querySelectorAll('li code')).map((code) => code.textContent);
    expect(own).toEqual(['/ns/agsc.ttl']);
  });

  it('says why when the node publishes no vocabulary', async () => {
    const vocabulary = {
      ...session([]),
      ready: () =>
        Promise.resolve({ ok: false as const, text: 'This node does not publish its vocabulary.' }),
    };
    const { root, ctx } = mounted({ graph: session([]), vocabulary });
    vocabTab.mount(root, ctx);
    await flush();
    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'This node does not publish its vocabulary.',
    );
    expect(root.textContent).toContain('The node names no vocabulary file on its own address.');
  });
});

describe('Page data tab', () => {
  it('shows the JSON-LD as text in a pre, nothing as markup', async () => {
    const block = '{"@type":"Thing","name":"<script>alert(1)</script>"}';
    const { root, ctx } = mounted({
      graph: session([]),
      pageData: () => Promise.resolve({ title: 't', og: {}, jsonLd: [block], links: [] }),
    });
    pageDataTab.mount(root, ctx);
    await flush();
    await flush();
    const pre = root.querySelector('pre');
    expect(pre?.textContent).toContain('"name": "<script>alert(1)</script>"');
    expect(root.querySelector('script')).toBeNull();
  });

  it('cuts at 100,000 characters and says so; says when there is none', async () => {
    const big = JSON.stringify({ text: 'x'.repeat(150_000) });
    const { root, ctx } = mounted({
      graph: session([]),
      pageData: () => Promise.resolve({ title: 't', og: {}, jsonLd: [big], links: [] }),
    });
    pageDataTab.mount(root, ctx);
    await flush();
    await flush();
    expect(root.querySelector('pre')?.textContent).toHaveLength(100_000);
    expect(root.textContent).toContain('Cut after 100000 characters.');
    const empty = mounted({ graph: session([]) });
    pageDataTab.mount(empty.root, empty.ctx);
    await flush();
    await flush();
    expect(empty.root.textContent).toContain('The page has no JSON-LD, or it could not be read.');
  });

  it('keeps a block that is not JSON as it came', () => {
    expect(prettyBlocks(['{"a":1}', 'not json'])).toBe('{\n  "a": 1\n}\n\nnot json');
  });
});
