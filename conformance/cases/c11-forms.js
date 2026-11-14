// SPDX-License-Identifier: Apache-2.0
// C11: declarative tools: <form toolname tooldescription toolautosubmit>, toolparamdescription,
// SubmitEvent.agentInvoked and respondWith, the :tool-form-active and :tool-submit-active
// pseudo-classes, a select (anyOf and enum), a form that navigates, and a form without
// toolautosubmit, where the page waits for the person to press Submit.
(function () {
  'use strict';
  const c = window.__conformance;

  function field(form, control, attributes) {
    for (const [key, value] of Object.entries(attributes)) control.setAttribute(key, value);
    form.append(control, ' ');
  }

  function build(stage, spec) {
    const form = document.createElement('form');
    form.id = spec.id;
    form.setAttribute('toolname', spec.id);
    form.setAttribute('tooldescription', spec.description);
    if (spec.autosubmit) form.setAttribute('toolautosubmit', '');
    if (spec.action) Object.assign(form, { action: spec.action, method: 'get' });
    field(form, document.createElement('input'), {
      name: 'q',
      toolparamdescription: 'Words to look for.',
    });
    if (spec.select) form.append(selectOf());
    form.append(
      Object.assign(document.createElement('button'), {
        type: 'submit',
        textContent: `Submit ${spec.id}`,
      }),
    );
    stage.append(form);
    return form;
  }

  function selectOf() {
    const select = document.createElement('select');
    select.name = 's';
    select.setAttribute('toolparamdescription', 'A size.');
    for (const size of ['small', 'large'])
      select.append(
        Object.assign(document.createElement('option'), { value: size, textContent: size }),
      );
    return select;
  }

  /** Answers an agent's submit with respondWith; a person's own submit is left to the page. */
  function answerAgent(form, prefix, log) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      log(`${form.id}: agentInvoked=${event.agentInvoked}`);
      if (event.agentInvoked && typeof event.respondWith === 'function') {
        event.respondWith(
          Promise.resolve(`${prefix}:${data.get('q') ?? ''}${data.get('s') ?? ''}`),
        );
      }
    });
  }

  async function setup(ctx) {
    const base = { description: 'A form that is also a tool.' };
    const auto = build(ctx.stage, { ...base, id: 'c11_auto', autosubmit: true });
    const wait = build(ctx.stage, {
      ...base,
      id: 'c11_wait',
      description: 'A form tool that waits for the person to press Submit.',
    });
    const select = build(ctx.stage, { ...base, id: 'c11_select', autosubmit: true, select: true });
    build(ctx.stage, {
      ...base,
      id: 'c11_navigate',
      autosubmit: true,
      action: '?case=c11&submitted=1',
    });
    answerAgent(auto, 'auto', (line) => ctx.log(line));
    answerAgent(wait, 'wait', (line) => ctx.log(line));
    answerAgent(select, 'select', (line) => ctx.log(line));
    // The browser registers a form's tool a moment after the form is in the page.
    if (c.features().declarativeForms) {
      await ctx.waitFor(async () => (await ctx.names()).includes('c11_navigate'));
    }
  }

  /** What is wrong with the listed form tools, or an empty string. */
  async function listProblem(ctx) {
    const names = await ctx.names();
    const missing = ['c11_auto', 'c11_wait', 'c11_select', 'c11_navigate'].filter(
      (name) => !names.includes(name),
    );
    if (missing.length) return `form tools not listed: ${missing.join(', ')}`;
    return schemaProblem((await ctx.tool('c11_select')).inputSchema ?? {});
  }

  function schemaProblem({ properties }) {
    if (!properties?.s?.enum && !properties?.s?.anyOf) return 'the select gave no enum or anyOf';
    if (properties.q?.description !== 'Words to look for.')
      return 'toolparamdescription was not used';
    return '';
  }

  async function check(ctx) {
    if (!c.features().declarativeForms) {
      return c.result.unsupported(
        'this browser has no SubmitEvent.agentInvoked (declarative tools)',
      );
    }
    const problem = await listProblem(ctx);
    if (problem) return c.result.fail(problem);
    const auto = await ctx.run('c11_auto', { q: 'x' });
    if (auto !== 'auto:x') return c.result.fail(`c11_auto gave ${auto}`);
    return await waitForSubmit(ctx);
  }

  async function waitForSubmit(ctx) {
    const call = ctx.run('c11_wait', { q: 'y' });
    const early = await Promise.race([
      call.then(
        () => 'done',
        () => 'rejected',
      ),
      ctx.sleep(400).then(() => 'waiting'),
    ]);
    if (early !== 'waiting') return c.result.fail(`c11_wait ended before Submit: ${early}`);
    document.querySelector('#c11_wait button').click();
    const done = await Promise.race([call, ctx.sleep(3000).then(() => 'no answer')]);
    const css = CSS.supports('selector(:tool-form-active)');
    return done === 'wait:y'
      ? c.result.pass(`waits for Submit; :tool-form-active ${css ? 'known' : 'unknown'}`)
      : c.result.fail(`after Submit c11_wait gave ${done}`);
  }

  c.add({
    id: 'c11',
    title: 'Declarative form tools',
    summary:
      'toolname, tooldescription, toolautosubmit, toolparamdescription, respondWith, agentInvoked, select, navigation, waiting for Submit',
    spec: c.links.declarative,
    setup,
    check,
  });
})();
