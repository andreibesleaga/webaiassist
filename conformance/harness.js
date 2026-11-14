// SPDX-License-Identifier: Apache-2.0
// The conformance harness: a registry of cases, the ?case= and ?mode= filters, and the report.
// Plain classic script, no libraries, no network. Each case file calls
// __conformance.add({ id, title, spec, setup(ctx), check(ctx) }):
//   setup(ctx)  registers the case's tools (and any buttons or forms) on the page
//   check(ctx)  tests the interface itself and returns { status, detail }
// status is 'pass', 'fail' or 'unsupported' (the browser lacks the part; the detail says which).
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const select = params.get('case');
  const selfRun = params.get('mode') === 'self';
  const cases = [];
  const api = { cases, done: false, results: [], params };
  window.__conformance = api;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pass = (detail = '') => ({ status: 'pass', detail });
  const fail = (detail) => ({ status: 'fail', detail });
  const unsupported = (detail) => ({ status: 'unsupported', detail });
  api.result = { pass, fail, unsupported };
  api.links = {
    spec: 'https://webmachinelearning.github.io/webmcp/',
    imperative: 'https://developer.chrome.com/docs/ai/webmcp/imperative-api',
    declarative: 'https://developer.chrome.com/docs/ai/webmcp/declarative-api',
    secure: 'https://developer.chrome.com/docs/ai/webmcp/secure-tools',
  };

  /** A string as JSON with every character outside printable ASCII written as \\uXXXX. */
  const ascii = (value) =>
    JSON.stringify(value).replace(
      /[^\x20-\x7e]/g,
      (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );

  const text = (error) =>
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  function element(tag, content, attributes = {}) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  /** registerTool with a signal of its own, so `remove(name)` can take the tool away again. */
  function registration(mc) {
    const regs = new Map();
    return {
      async register(definition) {
        const controller = new AbortController();
        await mc.registerTool(definition, { signal: controller.signal });
        regs.set(definition.name, controller);
      },
      remove: (name) => regs.get(name)?.abort(),
    };
  }

  /** The reading side: list tools, find one, run one. */
  function reading(mc) {
    const tools = async (options) => await mc.getTools(options);
    const reader = {
      tools,
      names: async (options) => (await tools(options)).map((tool) => tool.name),
      tool: async (name) => (await tools()).find((tool) => tool.name === name),
    };
    reader.run = async (name, input = {}, options) => {
      const tool = await reader.tool(name);
      if (!tool) throw new Error(`no tool ${name}`);
      return await mc.executeTool(tool, input, options);
    };
    return reader;
  }

  async function waitFor(test, ms = 3000) {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (await test()) return true;
      await sleep(25);
    }
    return false;
  }

  /** What a case's setup and check work with. */
  function makeContext(stage) {
    const mc = document.modelContext;
    return {
      mc,
      stage,
      state: {},
      sleep,
      waitFor,
      text,
      ascii,
      param: (name) => params.get(name),
      ...registration(mc),
      ...reading(mc),
      button(label, id, handler) {
        const button = element('button', label, { id, type: 'button' });
        button.addEventListener('click', () => void handler());
        stage.append(button, ' ');
        return button;
      },
      log(line) {
        stage.append(element('p', line, { class: 'log' }));
      },
    };
  }

  function section(entry) {
    const node = element('section', undefined, { id: `case-${entry.id}`, class: 'case' });
    node.append(element('h3', `${entry.id.toUpperCase()}: ${entry.title}`));
    const link = element('a', 'Specification', { href: entry.spec, rel: 'noreferrer' });
    const stage = element('div', undefined, { class: 'stage' });
    const outcome = element('p', 'Not run yet.', { class: 'outcome', 'data-status': 'idle' });
    node.append(element('p', undefined, { class: 'spec' }), outcome, stage);
    node.querySelector('.spec').append(link, ` · ${entry.summary ?? ''}`);
    document.getElementById('cases')?.append(node);
    return { stage, outcome };
  }

  function show(entry, view, result) {
    view.outcome.dataset.status = result.status;
    view.outcome.textContent = `${result.status}${result.detail ? `: ${result.detail}` : ''}`;
    const row = document.getElementById(`row-${entry.id}`);
    if (row) {
      row.dataset.status = result.status;
      row.querySelector('.status').textContent = result.status;
      row.querySelector('.detail').textContent = result.detail;
    }
  }

  api.add = function add(entry) {
    cases.push(entry);
  };

  /** Registers the case's tools once; a failing setup is a failed case, never a crash. */
  async function setUp(entry) {
    if (entry.view) return entry.error;
    entry.view = section(entry);
    entry.ctx = makeContext(entry.view.stage);
    try {
      await entry.setup(entry.ctx);
    } catch (error) {
      entry.error = text(error);
    }
    return entry.error;
  }

  function features() {
    const mc = document.modelContext;
    const has = (name) => typeof mc?.[name] === 'function';
    return {
      modelContext: Boolean(mc),
      registerTool: has('registerTool'),
      getTools: has('getTools'),
      executeTool: has('executeTool'),
      unregisterTool: has('unregisterTool'),
      declarativeForms:
        typeof SubmitEvent !== 'undefined' && 'agentInvoked' in SubmitEvent.prototype,
    };
  }

  async function runOne(entry) {
    const error = await setUp(entry);
    let result;
    if (error) result = fail(`setup failed: ${error}`);
    else {
      try {
        result = await entry.check(entry.ctx);
      } catch (thrown) {
        result = fail(`check threw ${text(thrown)}`);
      }
    }
    show(entry, entry.view, result);
    return { id: entry.id, title: entry.title, ...result };
  }

  api.features = features;
  api.report = () => ({
    userAgent: navigator.userAgent,
    url: location.href.split('?')[0],
    features: features(),
    results: api.results,
  });

  api.runAll = async function runAll(only) {
    if (!document.modelContext) {
      api.results = cases.map((e) => ({
        id: e.id,
        title: e.title,
        ...unsupported('no document.modelContext'),
      }));
      return finish();
    }
    const chosen = only ? cases.filter((e) => e.id === only) : cases;
    const results = [];
    for (const entry of chosen) results.push(await runOne(entry));
    api.results = results;
    return finish();
  };

  function finish() {
    api.done = true;
    const summary = document.getElementById('summary');
    if (summary) summary.textContent = summaryLine(api.results);
    return api.report();
  }

  function summaryLine(results) {
    const count = (status) => results.filter((r) => r.status === status).length;
    return `${results.length} cases: ${count('pass')} pass, ${count('unsupported')} unsupported, ${count('fail')} fail.`;
  }

  function listCases() {
    const body = document.getElementById('case-list');
    for (const entry of cases) {
      const row = element('tr', undefined, { id: `row-${entry.id}`, 'data-status': 'idle' });
      const link = element('a', entry.id, { href: `?case=${entry.id}` });
      const first = element('td');
      first.append(link);
      row.append(
        first,
        element('td', entry.title),
        element('td', 'not run', { class: 'status' }),
        element('td', '', { class: 'detail' }),
      );
      body.append(row);
    }
  }

  function showFeatures() {
    const list = document.getElementById('features');
    for (const [name, value] of Object.entries(features())) {
      list.append(element('li', `${name}: ${value ? 'yes' : 'no'}`));
    }
  }

  async function start() {
    cases.sort((a, b) => a.id.localeCompare(b.id));
    listCases();
    showFeatures();
    document.getElementById('run-all')?.addEventListener('click', () => void api.runAll());
    if (!document.modelContext) {
      document.getElementById('no-support').hidden = false;
    }
    if (select === null) return;
    const chosen = select === 'all' ? cases : cases.filter((entry) => entry.id === select);
    if (document.modelContext) for (const entry of chosen) await setUp(entry);
    api.ready = true;
    if (selfRun) await api.runAll(select === 'all' ? undefined : select);
  }

  api.ready = false;
  document.addEventListener('DOMContentLoaded', () => void start());
})();
