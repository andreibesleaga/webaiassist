// SPDX-License-Identifier: Apache-2.0
// One question: read the page, ask for the site when a tool is first used, run the agent loop
// with the Options (step cap, confirmation mode, memory), and let Stop end it.
import { runAgent, type AgentDeps } from '../core/agent-loop';
import { isNodeSite } from '../core/site-facts';
import { siteContext, siteContextLimit } from '../core/site-context';
import type { ToolBridge } from '../core/ports/tool-bridge';
import { siteGate } from '../core/site-consent';
import { byId } from './dom';
import { t } from './i18n';
import { withSlowStartNotice } from './slow-start';
import { note } from './panel-note';
import type { PanelController } from './panel-controller';
import { aiBlocked, refreshPage } from './panel-page';
import { dismissFirstRun } from './panel-notices';
import { graphToolFor } from './panel-graph-tool';
import { shownText } from './panel-problems';

/** The bridge used when the page has no tools. */
const NO_TOOLS: ToolBridge = {
  list: () => Promise.resolve({ tools: [] }),
  call: () => Promise.resolve({ ok: false, text: 'No tools are available.' }),
  onChange: () => () => undefined,
};

interface ToolPlan {
  readonly bridge: ToolBridge;
  readonly origin: string;
  readonly node: boolean;
  /** Asks "use the tools of this site?" when a tool is first about to be used. */
  readonly gate?: () => Promise<boolean>;
}

function toolPlan(ctx: PanelController): ToolPlan {
  const page = ctx.state.page;
  const info = page?.info;
  if (!info) return { bridge: NO_TOOLS, origin: page?.origin ?? '-', node: false };
  const origin = info.origin;
  const node = isNodeSite(
    info.tools.map((x) => x.name),
    info.linkset,
    ctx.state.site?.facts,
  );
  if (info.tools.length === 0) return { bridge: NO_TOOLS, origin, node };
  const site = { origin, toolCount: info.tools.length };
  const gate = siteGate(
    ctx.deps.grants,
    (r) => ctx.ui.confirmSite(r),
    site,
    () => note(ctx, t('siteDenied')),
  );
  return { bridge: ctx.deps.bridge, origin, node, gate };
}

function setRunning(ctx: PanelController, controller: AbortController | undefined): void {
  ctx.state.running = controller;
  byId<HTMLButtonElement>(ctx.deps.doc, 'send').disabled = controller !== undefined;
  byId<HTMLButtonElement>(ctx.deps.doc, 'stop').disabled = controller === undefined;
}

/** Marks the run as started: the controls, the origin it is bound to, and no switch or page change yet. */
function beginRun(ctx: PanelController, controller: AbortController, origin: string): void {
  setRunning(ctx, controller);
  Object.assign(ctx.state, { runOrigin: origin, stoppedBySwitch: false, pageChangedTo: undefined });
}

/** The read page text, used once and only on the tab and site it was read on. */
function pageTextFor(ctx: PanelController, tabId: number, origin: string): string | undefined {
  const read = ctx.state.pageText;
  ctx.state.pageText = undefined;
  if (!read || aiBlocked(ctx)) return undefined;
  if (read.tabId === tabId && read.origin === origin) return read.text;
  note(ctx, t('siteChanged', { origin: read.origin }));
  return undefined;
}

/** The site facts for this question: when Options allow them, the site did not ask for no AI
 *  input (or the user overrode it), and the facts are of the site the run is bound to. */
function siteFactsFor(ctx: PanelController, origin: string): string | undefined {
  const facts = ctx.state.site?.facts;
  if (!facts || facts.origin !== origin || !ctx.state.settings.siteFacts || aiBlocked(ctx)) {
    return undefined;
  }
  const capabilities = ctx.state.runtime?.model.capabilities();
  return siteContext(facts, capabilities ? siteContextLimit(capabilities) : undefined);
}

type Parts = Pick<AgentDeps, 'model' | 'memory' | 'ui'>;

function agentDepsFor(ctx: PanelController, parts: Parts, plan: ToolPlan): AgentDeps {
  const { clock, validator } = ctx.deps;
  const gate = plan.gate ? { siteGate: plan.gate } : {};
  return { ...parts, bridge: plan.bridge, clock, validator, ...gate };
}

async function runQuestion(ctx: PanelController, text: string, tabId: number): Promise<void> {
  const { deps, state, ui } = ctx;
  const model = state.runtime?.model;
  if (!model) return;
  state.settings = await deps.loadSettings();
  const plan = toolPlan(ctx);
  const memory = await deps.memory(state.settings);
  const controller = new AbortController();
  beginRun(ctx, controller, plan.origin);
  const pageText = pageTextFor(ctx, tabId, plan.origin);
  const siteText = siteFactsFor(ctx, plan.origin);
  const notice = withSlowStartNotice(ui);
  const graph = await graphToolFor(ctx, plan, tabId);
  const agentDeps = {
    ...graph.deps,
    ...agentDepsFor(ctx, { model, memory, ui: notice.ui }, plan),
  };
  const result = await runAgent(agentDeps, {
    tabId,
    origin: plan.origin,
    userText: text,
    history: await memory.loadChat(plan.origin),
    maxSteps: state.settings.maxSteps,
    signal: controller.signal,
    node: plan.node,
    confirmEveryCall: state.settings.confirmMode === 'every-call',
    ...graph.scope,
    ...(pageText === undefined ? {} : { pageText }),
    ...(siteText === undefined ? {} : { siteContext: siteText }),
  });
  notice.done();
  endNotes(ctx, result.status === 'stopped');
}

/** The plain lines at the end of an answer: stopped (unless a switch said why), page changed. */
function endNotes(ctx: PanelController, stopped: boolean): void {
  const { state, ui } = ctx;
  if (stopped && !state.stoppedBySwitch) ui.show({ kind: 'error', text: t('stopped') });
  if (state.pageChangedTo !== undefined) {
    ui.show({ kind: 'note', text: t('pageChangedTo', { title: state.pageChangedTo }) });
  }
}

async function send(ctx: PanelController, text: string): Promise<void> {
  const { deps, ui } = ctx;
  if (!ctx.state.runtime) return ui.show({ kind: 'error', text: t('noModel') });
  const tabId = await deps.targetTab();
  if (tabId === undefined) return ui.show({ kind: 'error', text: t('noTab') });
  await refreshPage(ctx, tabId);
  await ctx.state.siteLoading;
  ui.addUser(text);
  dismissFirstRun(ctx);
  try {
    await runQuestion(ctx, text, tabId);
  } catch (error) {
    ui.show({ kind: 'error', text: shownText(error) });
    ctx.report(error);
  } finally {
    ui.showDraft('');
    setRunning(ctx, undefined);
  }
}

function stop(ctx: PanelController): void {
  ctx.state.running?.abort();
  ctx.ui.cancelDialog();
}

export function bindQuestion(ctx: PanelController): void {
  const doc = ctx.deps.doc;
  const form = byId<HTMLFormElement>(doc, 'ask');
  const question = byId<HTMLTextAreaElement>(doc, 'question');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = question.value.trim();
    if (text === '' || ctx.state.running) return;
    question.value = '';
    void send(ctx, text);
  });
  question.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit();
  });
  byId(doc, 'stop').addEventListener('click', () => stop(ctx));
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && ctx.state.running) stop(ctx);
  });
}
